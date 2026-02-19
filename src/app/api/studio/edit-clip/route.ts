import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitVideoToVideo } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import type { Influencer } from '@/types'

// POST /api/studio/edit-clip
//
// Post-edit a single clip in a completed job using Kling omni "base" editing mode.
// The original clip's video is passed as the editing target; the edit_prompt
// describes what to change (background, expression, action, etc.)
//
// The clip is updated in-place (same clip_id, same clip_index), so the
// existing stitch route can re-run over the same clips without schema changes.
//
// Flow:
//   1. Auth + ownership check
//   2. Fetch clip → must be status=done and have video_url
//   3. Fetch job + influencer
//   4. Submit kling-v3-omni with video_list: [{url, refer_type: "base"}]
//   5. Reset clip: status=submitted, new kling_task_id, clear video_url
//   6. Reset job: status=generating
//   7. Webhook fires on completion → re-stitches automatically
//
// No credit deduction — editing is a refinement of already-paid generation.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { clip_id, edit_prompt, keep_sound } = await req.json()
  if (!clip_id || !edit_prompt?.trim()) {
    return apiError('clip_id and edit_prompt are required', 400)
  }

  const service = await createServiceClient()

  // Fetch clip with its job (service role — clips have no RLS)
  const { data: clip } = await service
    .from('clips')
    .select('*, jobs(*)')
    .eq('id', clip_id)
    .single()

  if (!clip) return apiError('Clip not found', 404)
  if (clip.jobs?.user_id !== user.id) return apiError('Forbidden', 403)
  if (clip.status !== 'done') return apiError('Clip must be done before editing', 400)
  if (!clip.video_url) return apiError('Clip has no video to edit', 400)

  const job = clip.jobs
  const influencerId = job.influencer_ids?.[0]
  if (!influencerId) return apiError('Job has no influencer', 400)

  // Fetch influencer
  const { data: inf } = await service
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .single() as { data: Influencer | null }

  if (!inf) return apiError('Influencer not found', 404)

  // Get presigned URL for influencer's frontal image
  const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : inf.frontal_image_url || ''

  const callbackUrl = getCallbackUrl()

  // Submit to Kling omni with the existing clip video as editing base.
  // "base" mode: Kling modifies the source video according to edit_prompt.
  // keep_sound: if true, original clip audio is preserved; if false, silent output.
  const resp = await submitVideoToVideo({
    prompt: edit_prompt.trim(),
    imageUrl,
    referenceVideoUrl: clip.video_url,
    referType: 'base',
    keepOriginalSound: Boolean(keep_sound),
    elementId: inf.kling_element_id ?? undefined,
    voiceId: inf.kling_element_voice_id ?? undefined,
    totalDuration: job.duration_s ?? 10,
    aspectRatio: job.aspect_ratio ?? '9:16',
    callbackUrl,
  })

  const taskId = resp?.data?.task_id
  if (!taskId) {
    const errMsg = resp?.message || resp?.data?.task_status_msg || 'Kling rejected the edit request'
    return apiError(errMsg, 502)
  }

  // Reset clip in-place: new task, back to submitted, clear old video URLs.
  // The webhook will update video_url once the edit completes, then re-stitch.
  await service.from('clips').update({
    status: 'submitted',
    kling_task_id: taskId,
    video_url: null,
    lipsync_url: null,
    error_msg: null,
    prompt: edit_prompt.trim(),
  }).eq('id', clip_id)

  // Reset job status so the progress UI reactivates
  await service.from('jobs').update({ status: 'generating' }).eq('id', job.id)

  return NextResponse.json({ ok: true, clip_id, task_id: taskId })
}
