import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import type { ScriptClip } from '@/types'

const CREDIT_COST = 50

const ANIME_STYLE_VISUAL: Record<string, string> = {
  cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic cityscape, high-tech atmosphere',
  ancient:   'traditional Chinese painting style, ink wash, elegant oriental aesthetics',
  modern:    'modern urban style, fashionable, lifestyle scenes, clean composition',
  cute:      'cute anime style, kawaii, pastel colors, expressive character',
  fantasy:   'fantasy magic world, epic lighting, colorful special effects, mystical',
  minimal:   'minimalist, pure background, premium quality, elegant simplicity',
}

// Group clips into batches: max 6 shots per batch AND max 15s total per batch
function groupClips(clips: ScriptClip[]): ScriptClip[][] {
  const groups: ScriptClip[][] = []
  let current: ScriptClip[] = []
  let currentDuration = 0

  for (const clip of clips) {
    const d = clip.duration || 5
    if (current.length >= 6 || (currentDuration + d > 15 && current.length > 0)) {
      groups.push(current)
      current = []
      currentDuration = 0
    }
    current.push(clip)
    currentDuration += d
  }
  if (current.length > 0) groups.push(current)
  return groups
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandName, productName, animeStyle, influencerId, platform, aspectRatio, script, lang } = await req.json()
  if (!brandName || !productName || !influencerId || !platform || !script) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const service = await createServiceClient()

  const { error: deductErr } = await service.rpc('deduct_credits', {
    p_user_id: user.id, p_amount: CREDIT_COST, p_reason: `动漫营销: ${brandName} ${productName}`,
  })
  if (deductErr?.message?.includes('insufficient_credits')) {
    return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
  }

  // Presign frontal image URL so Kling can access it
  const frontalKey = influencer.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : influencer.frontal_image_url || ''

  const clips = script as ScriptClip[]
  const styleVisual = ANIME_STYLE_VISUAL[animeStyle] || 'anime style'
  const stylePrefix = `${influencer.name} (${influencer.tagline}), ${styleVisual}. Brand: ${brandName}, product: ${productName}. Voice: ${influencer.voice_prompt}.`

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'anime', status: 'generating', language: lang || 'zh',
    title: `动漫营销: ${brandName} × ${influencer.name}`, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COST,
  }).select().single()
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  const CALLBACK = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kling`
  const groups = groupClips(clips)

  // Create one clip record per group
  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '',
  }))
  const { data: clipRows } = await service.from('clips').insert(clipInserts).select()

  // Submit each group to Kling
  await Promise.allSettled(groups.map(async (group, gi) => {
    const groupDuration = group.reduce((s, c) => s + (c.duration || 5), 0)

    let resp
    if (group.length === 1) {
      // Single clip: intelligence mode — model handles camera work freely
      const prompt = [
        stylePrefix,
        `Scene: ${group[0].shot_description}`,
        group[0].dialogue ? `${influencer.name} says: "${group[0].dialogue}"` : '',
        'Vertical format, premium anime animation.',
      ].filter(Boolean).join(' ')

      resp = await submitMultiShotVideo({
        imageUrl,
        prompt,
        shotType: 'intelligence',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl: CALLBACK,
      })
    } else {
      // Multiple clips: customize mode — per-shot prompts
      resp = await submitMultiShotVideo({
        imageUrl,
        shots: group.map((c, si) => ({
          index: si + 1,
          prompt: [
            `${stylePrefix} Shot ${si + 1}:`,
            c.shot_description,
            c.dialogue ? `${influencer.name} says: "${c.dialogue}"` : '',
          ].filter(Boolean).join(' '),
          duration: c.duration || 5,
        })),
        shotType: 'customize',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl: CALLBACK,
      })
    }

    const taskId = resp?.data?.task_id
    if (taskId && clipRows) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: taskId })
        .eq('job_id', job.id).eq('clip_index', gi)
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
