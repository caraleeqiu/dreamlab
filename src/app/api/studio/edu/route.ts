import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { groupClips } from '@/lib/video-utils'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import type { ScriptClip } from '@/types'

// Micro-motion suffix — added to every prompt to reduce the "frozen mannequin" AI feel
const MOTION_SUFFIX = 'natural micro-movements while speaking, subtle hand gestures, realistic breathing, gentle environmental motion in background'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { topic, depth, influencerId, platform, aspectRatio, durationS, script, lang } = await req.json()
  if (!topic || !influencerId || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.edu, `edu: ${topic}`, lang || 'zh')
  if (creditError) return creditError

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'edu', status: 'generating', language: lang || 'zh',
    title: lang === 'en' ? `Science: ${topic}` : `科普: ${topic}`, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], duration_s: durationS, script, credit_cost: CREDIT_COSTS.edu,
  }).select().single()
  if (jobErr) {
    await service.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: CREDIT_COSTS.edu,
      p_reason: `refund:job_create_failed`,
    })
    return apiError(jobErr.message, 500)
  }

  const frontalKey = influencer.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : influencer.frontal_image_url || ''

  // Subject Library: only use element_id if registered (Kling API doesn't support frontal_image_url fallback)
  const elementList = influencer.kling_element_id
    ? [{ element_id: influencer.kling_element_id }]
    : undefined
  const voiceList = influencer.kling_element_voice_id
    ? [{ voice_id: influencer.kling_element_voice_id }]
    : undefined

  const depthDesc = depth === 'simple' ? 'accessible beginner-friendly' : depth === 'deep' ? 'expert-level analytical' : 'intermediate educational'
  const callbackUrl = getCallbackUrl()
  const clips = script as ScriptClip[]
  const groups = groupClips(clips)
  const stylePrefix = `${influencer.name} (${influencer.tagline}), ${depthDesc} educational content. Voice: ${influencer.voice_prompt}.`

  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '', provider: 'kling',
  }))
  await service.from('clips').insert(clipInserts)

  await Promise.allSettled(groups.map(async (group, gi) => {
    const groupDuration = Math.min(group.reduce((s, c) => s + (c.duration || 5), 0), 15)

    let resp
    if (group.length === 1) {
      const c = group[0]
      const anchorNote = c.consistency_anchor ? `[Scene anchor: ${c.consistency_anchor}]` : ''
      const prompt = [
        stylePrefix, anchorNote,
        `Scene: ${c.shot_description}.`,
        c.dialogue ? `${influencer.name} explains: "${c.dialogue}"` : '',
        MOTION_SUFFIX,
        'Vertical format 9:16, educational presentation quality.',
      ].filter(Boolean).join(' ')

      resp = await submitMultiShotVideo({
        imageUrl,
        prompt,
        shotType: 'intelligence',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        elementList,
        voiceList,
        callbackUrl,
      })
    } else {
      resp = await submitMultiShotVideo({
        imageUrl,
        shots: group.map((c, si) => {
          const anchorNote = c.consistency_anchor ? `[Scene anchor: ${c.consistency_anchor}]` : ''
          return {
            index: si + 1,
            prompt: [
              `${stylePrefix} Shot ${si + 1}:`,
              anchorNote, c.shot_description,
              c.dialogue ? `${influencer.name} explains: "${c.dialogue}"` : '',
              MOTION_SUFFIX,
            ].filter(Boolean).join(' '),
            duration: c.duration || 5,
          }
        }),
        shotType: 'customize',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        elementList,
        voiceList,
        callbackUrl,
      })
    }

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', provider: 'kling', kling_task_id: result.taskId, task_id: result.taskId })
        .eq('job_id', job.id).eq('clip_index', gi)
    } else {
      await failClipAndCheckJob(service, job.id, gi, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
