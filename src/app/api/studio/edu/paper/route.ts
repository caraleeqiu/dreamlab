import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import { groupClips } from '@/lib/video-utils'
import type { ScriptClip } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { content, influencerId, platform, aspectRatio, script, diagrams, lang } = await req.json()
  if (!content || !influencerId || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(
    service, user.id, CREDIT_COSTS.edu_paper,
    `论文解读: ${content.title || content.summary?.slice(0, 30)}`,
  )
  if (creditError) return creditError

  // Store diagram URLs as job metadata so the webhook can compose PiP
  const diagramUrls: string[][] = (diagrams ?? []).map(
    (d: { imageUrls: string[] }) => d.imageUrls,
  )

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'edu', status: 'generating', language: lang || 'zh',
    title: `论文解读: ${content.title}`,
    platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script,
    credit_cost: CREDIT_COSTS.edu_paper,
    // Store diagram URLs for the webhook stitch (PiP assembly)
    metadata: { sub_type: 'paper', diagram_urls: diagramUrls },
  }).select().single()
  if (jobErr) return apiError(jobErr.message, 500)

  const frontalKey = influencer.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : influencer.frontal_image_url || ''

  const clips = script as ScriptClip[]
  const stylePrefix = `${influencer.name} (${influencer.tagline}), academic paper explainer. Voice: ${influencer.voice_prompt}. The diagram fills the background; character appears as a small PiP in the corner.`

  const callbackUrl = getCallbackUrl()
  const groups = groupClips(clips)

  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '',
  }))
  await service.from('clips').insert(clipInserts).select()

  await Promise.allSettled(groups.map(async (group, gi) => {
    const groupDuration = group.reduce((s, c) => s + (c.duration || 8), 0)

    let resp
    if (group.length === 1) {
      const c = group[0]
      const prompt = [
        stylePrefix,
        `Scene: ${c.shot_description}`,
        c.dialogue ? `${influencer.name} says: "${c.dialogue}"` : '',
        'Academic explainer style, diagram visible in background, clear educational presentation.',
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
          duration: c.duration || 8,
        })),
        shotType: 'customize',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      })
    }

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: result.taskId })
        .eq('job_id', job.id).eq('clip_index', gi)
    } else {
      await failClipAndCheckJob(service, job.id, gi, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
