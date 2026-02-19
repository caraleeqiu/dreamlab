import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'
import { createLogger } from '@/lib/logger'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

// Point fluent-ffmpeg at the bundled static binary
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const logger = createLogger('webhook:kling')

// POST /api/webhooks/kling — Kling 回调
// 收到通知后主动查询任务状态（方案③，防伪造）
export async function POST(request: NextRequest) {
  const body = await request.json()
  const task_id = body?.data?.task_id || body?.task_id
  if (!task_id) return NextResponse.json({ ok: true })

  logger.info('callback received', { task_id })

  // 立即响应防止 Kling 重试
  handleCallback(task_id).catch(err => logger.error('handleCallback failed', { task_id, err: String(err) }))

  return NextResponse.json({ ok: true })
}

async function handleCallback(task_id: string) {
  const service = await createServiceClient()

  const { data: clip } = await service
    .from('clips')
    .select('*, jobs(*)')
    .eq('kling_task_id', task_id)
    .single()

  if (!clip) return

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

    const videoRes = await fetch(videoUrl)
    const buffer = Buffer.from(await videoRes.arrayBuffer())
    const key = `jobs/${clip.job_id}/clips/${clip.clip_index}.mp4`
    const r2Url = await uploadToR2(key, buffer, 'video/mp4')

    await service.from('clips').update({
      status: 'done',
      video_url: r2Url,
      lipsync_url: r2Url,
    }).eq('id', clip.id)

    logger.info('clip uploaded', { task_id, jobId: clip.job_id, clipIndex: clip.clip_index })
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
    await service.from('jobs').update({ status: 'stitching' }).eq('id', jobId)
    await stitchVideo(service, jobId)
  }
}

async function stitchVideo(service: Awaited<ReturnType<typeof createServiceClient>>, jobId: number) {
  const { data: clips } = await service
    .from('clips')
    .select('lipsync_url, clip_index')
    .eq('job_id', jobId)
    .order('clip_index')

  if (!clips || clips.length === 0) {
    await service.from('jobs').update({ status: 'failed', error_msg: 'No clips to stitch' }).eq('id', jobId)
    return
  }

  // Single clip: skip stitching
  if (clips.length === 1) {
    await service.from('jobs').update({
      status: 'done',
      final_video_url: clips[0].lipsync_url,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
    return
  }

  // Multiple clips: concatenate with ffmpeg-static (no Python required)
  const tmpDir = path.join(os.tmpdir(), `dreamlab_job_${jobId}`)
  try {
    fs.mkdirSync(tmpDir, { recursive: true })

    // Download each clip to disk
    for (const clip of clips) {
      const res = await fetch(clip.lipsync_url)
      if (!res.ok) throw new Error(`Failed to download clip ${clip.clip_index}: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(path.join(tmpDir, `clip_${clip.clip_index}.mp4`), buf)
    }

    // Build ffmpeg concat list file
    const listPath = path.join(tmpDir, 'concat.txt')
    const listContent = clips
      .map(c => `file '${path.join(tmpDir, `clip_${c.clip_index}.mp4`)}'`)
      .join('\n')
    fs.writeFileSync(listPath, listContent)

    const finalPath = path.join(tmpDir, 'final.mp4')

    // Run ffmpeg concat (stream copy — no re-encode, very fast)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(finalPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run()
    })

    // Upload stitched video to R2
    const finalBuf = fs.readFileSync(finalPath)
    const r2Key = `jobs/${jobId}/final.mp4`
    const finalUrl = await uploadToR2(r2Key, finalBuf, 'video/mp4')

    await service.from('jobs').update({
      status: 'done',
      final_video_url: finalUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

  } catch (err) {
    logger.error('stitch failed, falling back to first clip', { jobId, err: String(err) })
    // Fallback: mark done with first clip so users can still download individually
    await service.from('jobs').update({
      status: 'done',
      final_video_url: clips[0].lipsync_url,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
