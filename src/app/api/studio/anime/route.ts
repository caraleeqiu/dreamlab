import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
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

  const clips = script as ScriptClip[]
  const styleVisual = ANIME_STYLE_VISUAL[animeStyle] || 'anime style'
  const totalDuration = clips.reduce((sum, c) => sum + (c.duration || 5), 0)

  // Build one combined prompt for intelligence mode — Kling handles shot cuts automatically
  const shotDescriptions = clips.map((c, i) =>
    `Scene ${i + 1}: ${c.shot_description}${c.dialogue ? `. ${influencer.name} says: "${c.dialogue}"` : ''}`
  ).join('. ')
  const combinedPrompt = [
    `${influencer.name} (${influencer.tagline}), ${styleVisual}.`,
    `Brand: ${brandName}, product: ${productName}.`,
    `Voice style: ${influencer.voice_prompt}.`,
    shotDescriptions,
    `Vertical format, premium anime animation quality.`,
  ].join(' ')

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'anime', status: 'generating', language: lang || 'zh',
    title: `动漫营销: ${brandName} × ${influencer.name}`, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COST,
  }).select().single()
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  // Single clip record for the whole multi-shot video
  const { data: clipRows } = await service.from('clips').insert([{
    job_id: job.id, clip_index: 0, status: 'pending', prompt: combinedPrompt,
  }]).select()

  const CALLBACK = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kling`
  const resp = await submitMultiShotVideo({
    imageUrl: influencer.frontal_image_url || '',
    prompt: combinedPrompt,
    shotType: 'intelligence',
    totalDuration,
    aspectRatio: aspectRatio || '9:16',
    callbackUrl: CALLBACK,
  })

  const taskId = resp?.data?.task_id
  if (taskId && clipRows) {
    await service.from('clips').update({ status: 'submitted', kling_task_id: taskId })
      .eq('job_id', job.id).eq('clip_index', 0)
  }

  return NextResponse.json({ jobId: job.id })
}
