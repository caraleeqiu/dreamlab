import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// POST /api/webhooks/kling — Kling 回调
// 收到通知后主动查询任务状态（方案③，防伪造）
export async function POST(request: NextRequest) {
  const body = await request.json()
  const task_id = body?.data?.task_id || body?.task_id
  if (!task_id) return NextResponse.json({ ok: true })

  // 立即响应防止 Kling 重试
  handleCallback(task_id).catch(console.error)

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

  // Multiple clips: stitch with Python moviepy
  const tmpDir = path.join(os.tmpdir(), `dreamlab_job_${jobId}`)
  try {
    fs.mkdirSync(tmpDir, { recursive: true })

    // Download each clip
    for (const clip of clips) {
      const res = await fetch(clip.lipsync_url)
      if (!res.ok) throw new Error(`Failed to download clip ${clip.clip_index}`)
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(path.join(tmpDir, `clip_${clip.clip_index}.mp4`), buf)
    }

    // Write Python concat script
    const clipPaths = clips
      .map(c => path.join(tmpDir, `clip_${c.clip_index}.mp4`))
      .map(p => `r"${p}"`)
      .join(', ')

    const finalPath = path.join(tmpDir, 'final.mp4')
    const pyScript = `
import sys
from moviepy.editor import VideoFileClip, concatenate_videoclips

clip_paths = [${clipPaths}]
clips = [VideoFileClip(p) for p in clip_paths]
final = concatenate_videoclips(clips, method='compose')
final.write_videofile(r"${finalPath}", codec='libx264', audio_codec='aac', logger=None)
for c in clips:
    c.close()
final.close()
print("done")
`
    const pyPath = path.join(tmpDir, 'concat.py')
    fs.writeFileSync(pyPath, pyScript)

    // Run Python (5 min timeout)
    execSync(`python3 "${pyPath}"`, { timeout: 300_000 })

    // Upload result to R2
    const finalBuf = fs.readFileSync(finalPath)
    const r2Key = `jobs/${jobId}/final.mp4`
    const finalUrl = await uploadToR2(r2Key, finalBuf, 'video/mp4')

    await service.from('jobs').update({
      status: 'done',
      final_video_url: finalUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

  } catch (err) {
    console.error(`[stitchVideo] job ${jobId} failed:`, err)
    // Fallback: mark done with first clip so user can still download individually
    await service.from('jobs').update({
      status: 'done',
      final_video_url: clips[0].lipsync_url,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  } finally {
    // Cleanup tmp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
