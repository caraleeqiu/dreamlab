import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'

type Params = { params: Promise<{ id: string }> }

// GET /api/jobs/[id]/poll — 前端轮询，主动查 Kling 状态更新
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 验证 job 归属
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status, final_video_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!job) return NextResponse.json({ error: '任务不存在' }, { status: 404 })

  // 如果 job 已完成，直接返回
  if (job.status === 'done' || job.status === 'failed') {
    return NextResponse.json({ status: job.status, final_video_url: job.final_video_url })
  }

  // 查 pending/submitted 的切片，主动向 Kling 查状态
  const { data: clips } = await supabase
    .from('clips')
    .select('*')
    .eq('job_id', id)
    .in('status', ['submitted', 'processing'])

  const updates = await Promise.allSettled(
    (clips || []).map(async clip => {
      if (!clip.kling_task_id) return
      const resp = await getTaskStatus(clip.kling_task_id)
      const taskStatus = resp?.data?.task_status
      if (taskStatus === 'succeed') {
        await supabase.from('clips').update({ status: 'processing' }).eq('id', clip.id)
      } else if (taskStatus === 'failed') {
        await supabase.from('clips').update({ status: 'failed' }).eq('id', clip.id)
      }
    })
  )

  // 返回最新 clips 状态
  const { data: latestClips } = await supabase
    .from('clips')
    .select('clip_index, status, video_url, lipsync_url')
    .eq('job_id', id)
    .order('clip_index')

  const { data: latestJob } = await supabase
    .from('jobs')
    .select('status, final_video_url')
    .eq('id', id)
    .single()

  return NextResponse.json({
    status: latestJob?.status,
    final_video_url: latestJob?.final_video_url,
    clips: latestClips,
  })
}
