import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitSimpleVideo } from '@/lib/kling'
import type { ScriptClip, Influencer } from '@/types'

const CREDIT_COST = 30

const NARRATIVE_VISUAL: Record<string, string> = {
  skit:      'situational comedy, exaggerated expressions, fast-paced',
  cinematic: 'cinematic lighting, careful composition, emotional depth, film quality',
  vlog:      'first-person vlog, handheld, direct to camera, authentic feel',
  manga:     'manga-inspired, dynamic angles, exaggerated motion, bold composition',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyTitle, storyIdea, genre, narrativeStyle, influencerIds, platform, aspectRatio, durationS, script, lang } = await req.json()
  if (!influencerIds?.length || !platform || !script) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: influencers } = await supabase
    .from('influencers').select('*').in('id', influencerIds)
  if (!influencers?.length) return NextResponse.json({ error: 'Influencers not found' }, { status: 404 })

  const service = await createServiceClient()

  const { error: deductErr } = await service.rpc('deduct_credits', {
    p_user_id: user.id, p_amount: CREDIT_COST,
    p_reason: `故事短片: ${storyTitle || storyIdea.slice(0, 30)}`,
  })
  if (deductErr?.message?.includes('insufficient_credits')) {
    return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
  }

  const title = storyTitle || `故事: ${storyIdea.slice(0, 20)}...`
  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'story', status: 'generating', language: lang || 'zh',
    title, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: influencerIds, duration_s: durationS, script, credit_cost: CREDIT_COST,
  }).select().single()
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  const clipInserts = (script as ScriptClip[]).map(clip => ({ job_id: job.id, clip_index: clip.index, status: 'pending', prompt: '' }))
  const { data: clips } = await service.from('clips').insert(clipInserts).select()

  const infMap = Object.fromEntries((influencers as Influencer[]).map(inf => [inf.slug, inf]))
  const primaryInf = influencers[0] as Influencer
  const styleVisual = NARRATIVE_VISUAL[narrativeStyle] || 'cinematic style'
  const CALLBACK = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kling`

  await Promise.allSettled((script as ScriptClip[]).map(async (clip) => {
    const actor = infMap[clip.speaker] || primaryInf
    const dialoguePart = clip.dialogue ? `. [VOICE: ${actor.voice_prompt}]. "${clip.dialogue}"` : ''
    const prompt = `${clip.shot_description}. ${styleVisual}. ${genre} short film. ${actor.name}: ${actor.tagline}${dialoguePart}. Vertical, cinematic quality.`
    const resp = await submitSimpleVideo({ prompt, imageUrl: actor.frontal_image_url || '', durationS: clip.duration, aspectRatio: aspectRatio || '9:16', callbackUrl: CALLBACK })
    const taskId = resp?.data?.task_id
    if (taskId && clips) {
      await service.from('clips').update({ status: 'submitted', kling_task_id: taskId, prompt })
        .eq('job_id', job.id).eq('clip_index', clip.index)
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
