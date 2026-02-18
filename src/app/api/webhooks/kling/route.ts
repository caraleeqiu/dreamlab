import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'

// POST /api/webhooks/kling — Kling 回调
// 收到通知后主动查询任务状态（方案③，防伪造）
export async function POST(request: NextRequest) {
  const body = await request.json()
  const task_id = body?.data?.task_id || body?.task_id
  if (!task_id) return NextResponse.json({ ok: true })

  // 立即响应防止 Kling 重试
  // 异步处理
  handleCallback(task_id).catch(console.error)

  return NextResponse.json({ ok: true })
}

async function handleCallback(task_id: string) {
  const service = await createServiceClient()

  // 查询 clip 记录
  const { data: clip } = await service
    .from('clips')
    .select('*, jobs(*)')
    .eq('kling_task_id', task_id)
    .single()

  if (!clip) return

  // 主动向 Kling 查询真实状态（不信任 webhook body）
  const resp = await getTaskStatus(task_id)
  const task = resp?.data

  if (!task || task.task_status === 'processing') return
  if (task.task_status === 'failed') {
    await service.from('clips').update({ status: 'failed', error_msg: task.task_status_msg }).eq('id', clip.id)
    await checkAndUpdateJobStatus(service, clip.job_id)
    return
  }

  if (task.task_status === 'succeed') {
    const videoUrl = task.task_result?.videos?.[0]?.url
    if (!videoUrl) return

    // 下载视频到 R2
    const videoRes = await fetch(videoUrl)
    const buffer = Buffer.from(await videoRes.arrayBuffer())
    const key = `jobs/${clip.job_id}/clips/${clip.clip_index}.mp4`
    const r2Url = await uploadToR2(key, buffer, 'video/mp4')

    // Kling generate_audio:true 已在视频内生成口型同步音频
    // v1 直接标记 done；后续如需独立音轨口型可在此接入 Replicate
    await service.from('clips').update({
      status: 'done',
      video_url: r2Url,
      lipsync_url: r2Url,
    }).eq('id', clip.id)

    await checkAndUpdateJobStatus(service, clip.job_id)
  }
}

async function checkAndUpdateJobStatus(service: Awaited<ReturnType<typeof createServiceClient>>, jobId: number) {
  const { data: clips } = await service.from('clips').select('status').eq('job_id', jobId)
  if (!clips) return

  const allDone = clips.every(c => c.status === 'done')
  const anyFailed = clips.some(c => c.status === 'failed')

  if (anyFailed && clips.every(c => c.status === 'done' || c.status === 'failed')) {
    await service.from('jobs').update({ status: 'failed', error_msg: '部分切片生成失败' }).eq('id', jobId)
  } else if (allDone) {
    // 触发拼接（TODO: 调 moviepy Python 服务）
    await service.from('jobs').update({ status: 'stitching' }).eq('id', jobId)
    await stitchVideo(service, jobId)
  }
}

async function stitchVideo(service: Awaited<ReturnType<typeof createServiceClient>>, jobId: number) {
  // TODO: 调 Python moviepy 服务拼接 + 加字幕
  // 暂时标记 done，视频 URL 用第一个切片
  const { data: clips } = await service.from('clips').select('lipsync_url, clip_index').eq('job_id', jobId).order('clip_index')
  const finalUrl = clips?.[0]?.lipsync_url || ''

  await service.from('jobs').update({
    status: 'done',
    final_video_url: finalUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)
}
