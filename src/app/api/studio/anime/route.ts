import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'
import { groupClips } from '@/lib/video-utils'
import type { ScriptClip } from '@/types'

const ANIME_STYLE_VISUAL: Record<string, string> = {
  cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic cityscape, high-tech atmosphere',
  ancient:   'traditional Chinese painting style, ink wash, elegant oriental aesthetics',
  modern:    'modern urban style, fashionable, lifestyle scenes, clean composition',
  cute:      'cute anime style, kawaii, pastel colors, expressive character',
  fantasy:   'fantasy magic world, epic lighting, colorful special effects, mystical',
  minimal:   'minimalist, pure background, premium quality, elegant simplicity',
}


export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { brandName, productName, animeStyle, influencerId, platform, aspectRatio, script, lang } = await req.json()
  if (!brandName || !productName || !influencerId || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.anime, `动漫营销: ${brandName} ${productName}`)
  if (creditError) return creditError

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
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COSTS.anime,
  }).select().single()
  if (jobErr) return apiError(jobErr.message, 500)

  const callbackUrl = getCallbackUrl()
  const groups = groupClips(clips)

  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '',
  }))
  const { data: clipRows } = await service.from('clips').insert(clipInserts).select()

  await Promise.allSettled(groups.map(async (group, gi) => {
    const groupDuration = group.reduce((s, c) => s + (c.duration || 5), 0)

    let resp
    if (group.length === 1) {
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
        callbackUrl,
      })
    } else {
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
        callbackUrl,
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
