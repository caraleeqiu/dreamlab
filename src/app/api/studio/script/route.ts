import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildClipPrompt, submitImage2Video } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, createClipRecords } from '@/lib/job-service'
import type { ScriptClip, Influencer } from '@/types'

// POST /api/studio/script — 提交自定义脚本生成任务
// body: { title, platform, aspect_ratio, duration_s, influencer_ids, script, language }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { title, platform, aspect_ratio, duration_s, influencer_ids, script, language } = body

  if (!influencer_ids?.length || !script?.length || !platform || !aspect_ratio) {
    return apiError('Missing required fields', 400)
  }

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.script, 'script')
  if (creditError) return creditError

  const { data: influencers } = await supabase
    .from('influencers')
    .select('*')
    .in('id', influencer_ids)
  const infMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.id, i]))
  const slugMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.slug, i]))

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      type: 'script',
      status: 'scripting',
      language,
      title: title || '自定义脚本',
      platform,
      aspect_ratio,
      duration_s,
      influencer_ids,
      script,
      credit_cost: CREDIT_COSTS.script,
    })
    .select()
    .single()

  if (jobError || !job) return apiError(jobError?.message ?? '创建任务失败', 500)

  await supabase.from('jobs').update({ status: 'generating' }).eq('id', job.id)

  const clips = await createClipRecords(service, job.id, script as ScriptClip[])
  const callbackUrl = getCallbackUrl()

  const klingPromises = (script as ScriptClip[]).map(async (clip) => {
    const inf = slugMap[clip.speaker] ?? infMap[influencer_ids[0]]
    if (!inf) return

    const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
    const presigned = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url || ''

    const payload = {
      ...buildClipPrompt(clip, inf, presigned, presigned),
      aspect_ratio,
      callback_url: callbackUrl,
    }

    const resp = await submitImage2Video(payload)
    const taskId = resp?.data?.task_id
    if (taskId && clips) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: taskId, prompt: payload.prompt })
        .eq('job_id', job.id)
        .eq('clip_index', clip.index)
    }
  })

  await Promise.allSettled(klingPromises)

  return NextResponse.json({ job_id: job.id }, { status: 201 })
}
