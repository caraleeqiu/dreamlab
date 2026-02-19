import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitSimpleVideo } from '@/lib/kling'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, createClipRecords } from '@/lib/job-service'
import type { ScriptClip } from '@/types'

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
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.edu, `网红科普: ${topic}`)
  if (creditError) return creditError

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'edu', status: 'generating', language: lang || 'zh',
    title: `科普: ${topic}`, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], duration_s: durationS, script, credit_cost: CREDIT_COSTS.edu,
  }).select().single()
  if (jobErr) return apiError(jobErr.message, 500)

  const clips = await createClipRecords(service, job.id, script as ScriptClip[])
  const depthDesc = depth === 'simple' ? 'accessible beginner-friendly' : depth === 'deep' ? 'expert-level analytical' : 'intermediate educational'
  const callbackUrl = getCallbackUrl()

  await Promise.allSettled((script as ScriptClip[]).map(async (clip) => {
    const prompt = `${clip.shot_description}. ${influencer.name} presents: ${influencer.speaking_style || 'engaging'}. [VOICE: ${influencer.voice_prompt}]. ${depthDesc}. "${clip.dialogue}"`
    const resp = await submitSimpleVideo({ prompt, imageUrl: influencer.frontal_image_url || '', durationS: clip.duration, aspectRatio: aspectRatio || '9:16', callbackUrl })
    const taskId = resp?.data?.task_id
    if (taskId && clips) {
      await service.from('clips').update({ status: 'submitted', kling_task_id: taskId, prompt })
        .eq('job_id', job.id).eq('clip_index', clip.index)
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
