import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'
import { apiError } from '@/lib/api-response'

// POST /api/jobs/poll
// Manually poll Kling for pending/submitted clip statuses
// Body: { jobId?: number } — if omitted, polls all pending jobs for current user
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { jobId } = await req.json().catch(() => ({}))

  const service = await createServiceClient()

  // Get clips that need polling
  let query = service
    .from('clips')
    .select('*, jobs!inner(user_id)')
    .in('status', ['pending', 'submitted'])
    .not('kling_task_id', 'is', null)
    .eq('jobs.user_id', user.id)

  if (jobId) {
    query = query.eq('job_id', jobId)
  }

  const { data: clips, error } = await query.limit(20)
  if (error) return apiError(error.message, 500)
  if (!clips?.length) {
    return NextResponse.json({ message: 'No pending clips to poll', results: [] })
  }

  const results = await Promise.all(clips.map(async (clip) => {
    try {
      const resp = await getTaskStatus(clip.kling_task_id)
      const status = resp?.data?.task_status
      const videoUrl = resp?.data?.task_result?.videos?.[0]?.url

      if (status === 'succeed' && videoUrl) {
        // Mirror to R2
        let r2Url = videoUrl
        try {
          const r = await fetch(videoUrl)
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer())
            r2Url = await uploadToR2(`clips/${clip.job_id}/${clip.clip_index}.mp4`, buf, 'video/mp4')
          }
        } catch { /* use original */ }

        await service.from('clips')
          .update({ status: 'done', video_url: r2Url })
          .eq('id', clip.id)

        // Check if all clips done
        const { data: allClips } = await service
          .from('clips')
          .select('status')
          .eq('job_id', clip.job_id)

        const allDone = allClips?.every(c => c.status === 'done')
        if (allDone) {
          await service.from('jobs').update({ status: 'done' }).eq('id', clip.job_id)
        }

        return { clipId: clip.id, taskId: clip.kling_task_id, status: 'done', videoUrl: r2Url }
      } else if (status === 'failed') {
        const errMsg = resp?.data?.task_status_msg || 'Kling task failed'
        await service.from('clips')
          .update({ status: 'failed', error: errMsg })
          .eq('id', clip.id)
        return { clipId: clip.id, taskId: clip.kling_task_id, status: 'failed', error: errMsg }
      } else {
        // Still processing
        return { clipId: clip.id, taskId: clip.kling_task_id, status: status || 'unknown', raw: resp?.data }
      }
    } catch (err) {
      return { clipId: clip.id, taskId: clip.kling_task_id, status: 'error', error: String(err) }
    }
  }))

  return NextResponse.json({ results })
}
