import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitText2Video } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import type { ScriptClip } from '@/types'

// POST /api/studio/edu/cinematic
// Pure scene animation — no character, no reference image.
// Each clip submitted to Kling text2video independently.
// When Seedance API is available, clips with provider:'seedance' will be routed there.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { content, visualStyle, platform, aspectRatio, script, lang } = await req.json()
  if (!content || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const service = await createServiceClient()
  const creditError = await deductCredits(
    service, user.id, CREDIT_COSTS.edu_cinematic,
    `edu_cinematic: ${content.title || content.summary?.slice(0, 30)}`,
    lang || 'zh',
  )
  if (creditError) return creditError

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'edu', status: 'generating', language: lang || 'zh',
    title: lang === 'en' ? `Cinematic: ${content.title}` : `全动画: ${content.title}`,
    platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [], script,
    credit_cost: CREDIT_COSTS.edu_cinematic,
    metadata: { sub_type: 'cinematic', visual_style: visualStyle },
  }).select().single()
  if (jobErr) return apiError(jobErr.message, 500)

  const clips = script as ScriptClip[]
  const callbackUrl = getCallbackUrl()

  // Cinematic mode: one clip record per script clip (1:1 mapping, no grouping)
  // Each clip gets its own text2video task
  const clipInserts = clips.map((_, i) => ({
    job_id: job.id, clip_index: i, provider: 'seedance', status: 'pending', prompt: '',
  }))
  await service.from('clips').insert(clipInserts)

  await Promise.allSettled(clips.map(async (clip, i) => {
    const duration = Math.min(Math.max(clip.duration || 5, 4), 15)

    // Build a rich cinematic prompt
    const cameraTag = [clip.shot_type, clip.camera_movement].filter(Boolean).join(', ')
    const prompt = [
      cameraTag ? `[${cameraTag}]` : '',
      clip.shot_description,
      clip.voiceover ? `Voiceover context: "${clip.voiceover}"` : '',
      `Duration: ${duration}s. ${aspectRatio === '16:9' ? 'Landscape' : 'Vertical'} format.`,
      'Photorealistic, high production value, no text overlays, no human faces.',
    ].filter(Boolean).join(' ')

    const resp = await submitText2Video({
      prompt,
      totalDuration: duration,
      aspectRatio: aspectRatio || '9:16',
      callbackUrl,
    })

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: result.taskId, task_id: result.taskId })
        .eq('job_id', job.id).eq('clip_index', i)
    } else {
      await failClipAndCheckJob(service, job.id, i, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
