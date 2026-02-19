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

// ─── ffmpeg helpers ──────────────────────────────────────────────────────────

function runFfmpeg(cmd: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd.on('end', () => resolve()).on('error', (err: Error) => reject(err)).run()
  })
}

/**
 * Compose a PiP clip: diagram image as full-screen background + character clip
 * in the bottom-right corner. Burns subtitle text from the dialogue.
 *
 * Layout (9:16 video at 1080×1920):
 *   - Background: diagram image scaled to fill the frame
 *   - PiP: character clip at 25% width, bottom-right, 16px margin
 *   - Subtitle: dialogue text at bottom, white with shadow
 */
async function composePipClip(opts: {
  characterVideoPath: string
  diagramImagePath: string | null
  outputPath: string
  dialogue: string
  aspectRatio: string
}): Promise<void> {
  const { characterVideoPath, diagramImagePath, outputPath, dialogue, aspectRatio } = opts

  // Determine output dimensions
  const [wStr, hStr] = aspectRatio.split(':')
  const baseW = 1080
  const baseH = Math.round(baseW * parseInt(hStr) / parseInt(wStr))
  const pipW = Math.round(baseW * 0.28)       // PiP at 28% of width
  const pipX = baseW - pipW - 20              // right margin 20px
  const pipY = baseH - Math.round(pipW * parseInt(hStr) / parseInt(wStr)) - 100  // above subtitle bar

  // Escape dialogue for ffmpeg drawtext (single quotes → escaped)
  const safeDialogue = dialogue
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')

  if (diagramImagePath) {
    // Full PiP: diagram bg + character overlay + subtitle
    const filterComplex = [
      // Scale diagram to fill frame
      `[0:v]scale=${baseW}:${baseH},setsar=1[bg]`,
      // Scale character video into PiP size, rounded box
      `[1:v]scale=${pipW}:-2[pip]`,
      // Overlay PiP on background
      `[bg][pip]overlay=${pipX}:${pipY}[composed]`,
      // Burn subtitle at bottom
      `[composed]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:` +
        `text='${safeDialogue}':fontcolor=white:fontsize=32:` +
        `borderw=2:bordercolor=black:` +
        `x=(w-text_w)/2:y=h-80[out]`,
    ].join(';')

    await runFfmpeg(
      ffmpeg()
        .input(diagramImagePath)           // [0] diagram image (loop to video duration)
        .inputOptions(['-loop', '1'])
        .input(characterVideoPath)          // [1] character clip
        .complexFilter(filterComplex, 'out')
        .outputOptions([
          '-map', '[out]',
          '-map', '1:a?',                  // keep audio from character clip if present
          '-c:v', 'libx264',
          '-crf', '23',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-shortest',
        ])
        .output(outputPath),
    )
  } else {
    // No diagram: just burn subtitle on character clip
    const filterComplex = [
      `[0:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:` +
        `text='${safeDialogue}':fontcolor=white:fontsize=32:` +
        `borderw=2:bordercolor=black:` +
        `x=(w-text_w)/2:y=h-80[out]`,
    ].join(';')

    await runFfmpeg(
      ffmpeg()
        .input(characterVideoPath)
        .complexFilter(filterComplex, 'out')
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a?',
          '-c:v', 'libx264',
          '-crf', '23',
          '-preset', 'fast',
          '-c:a', 'aac',
        ])
        .output(outputPath),
    )
  }
}

async function stitchVideo(service: Awaited<ReturnType<typeof createServiceClient>>, jobId: number) {
  // Load job metadata to detect sub_type and diagram_urls
  const { data: job } = await service
    .from('jobs')
    .select('metadata, script')
    .eq('id', jobId)
    .single()

  const { data: clips } = await service
    .from('clips')
    .select('lipsync_url, clip_index')
    .eq('job_id', jobId)
    .order('clip_index')

  if (!clips || clips.length === 0) {
    await service.from('jobs').update({ status: 'failed', error_msg: 'No clips to stitch' }).eq('id', jobId)
    return
  }

  const isPaper = job?.metadata?.sub_type === 'paper'
  const diagramUrls: string[][] = isPaper ? (job?.metadata?.diagram_urls ?? []) : []

  // Extract dialogue per clip from the job script (for subtitle burning)
  const scriptClips: Array<{ dialogue?: string; diagram_index?: number }> = job?.script ?? []

  // Single clip with no PiP: skip stitching
  if (clips.length === 1 && !isPaper) {
    await service.from('jobs').update({
      status: 'done',
      final_video_url: clips[0].lipsync_url,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
    return
  }

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

    let processedPaths: string[]

    if (isPaper) {
      // Paper mode: compose PiP for each clip (diagram bg + character pip + subtitle)
      processedPaths = await Promise.all(
        clips.map(async clip => {
          const scriptClip = scriptClips[clip.clip_index] ?? {}
          const diagIdx = scriptClip.diagram_index ?? clip.clip_index
          const diagUrlList = diagramUrls[diagIdx] ?? []
          const diagImgUrl = diagUrlList[0] ?? null

          // Download diagram image if available
          let diagImgPath: string | null = null
          if (diagImgUrl) {
            try {
              const imgRes = await fetch(diagImgUrl)
              if (imgRes.ok) {
                const imgBuf = Buffer.from(await imgRes.arrayBuffer())
                diagImgPath = path.join(tmpDir, `diag_${clip.clip_index}.jpg`)
                fs.writeFileSync(diagImgPath, imgBuf)
              }
            } catch {
              // Non-fatal: continue without diagram
            }
          }

          const characterPath = path.join(tmpDir, `clip_${clip.clip_index}.mp4`)
          const composedPath = path.join(tmpDir, `composed_${clip.clip_index}.mp4`)

          await composePipClip({
            characterVideoPath: characterPath,
            diagramImagePath: diagImgPath,
            outputPath: composedPath,
            dialogue: scriptClip.dialogue ?? '',
            aspectRatio: '9:16',
          })

          return composedPath
        }),
      )
    } else {
      // Regular mode: burn subtitles only (no PiP)
      processedPaths = await Promise.all(
        clips.map(async clip => {
          const scriptClip = scriptClips[clip.clip_index] ?? {}
          const dialogue = scriptClip.dialogue ?? ''

          if (!dialogue) {
            // No subtitle: use raw clip as-is
            return path.join(tmpDir, `clip_${clip.clip_index}.mp4`)
          }

          const inputPath = path.join(tmpDir, `clip_${clip.clip_index}.mp4`)
          const outputPath = path.join(tmpDir, `sub_${clip.clip_index}.mp4`)

          await composePipClip({
            characterVideoPath: inputPath,
            diagramImagePath: null,
            outputPath,
            dialogue,
            aspectRatio: '9:16',
          })

          return outputPath
        }),
      )
    }

    // Concat all processed clips
    const finalPath = path.join(tmpDir, 'final.mp4')

    if (processedPaths.length === 1) {
      // Single processed clip: no concat needed
      fs.copyFileSync(processedPaths[0], finalPath)
    } else {
      // Build concat list from processed (re-encoded) clips
      const listPath = path.join(tmpDir, 'concat.txt')
      const listContent = processedPaths.map(p => `file '${p}'`).join('\n')
      fs.writeFileSync(listPath, listContent)

      await runFfmpeg(
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(finalPath),
      )
    }

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
    await service.from('jobs').update({
      status: 'done',
      final_video_url: clips[0].lipsync_url,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
