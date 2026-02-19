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

  // Look up by kling_task_id first; fall back to unified task_id field
  let { data: clip } = await service
    .from('clips')
    .select('*, jobs(*)')
    .eq('kling_task_id', task_id)
    .maybeSingle()

  if (!clip) {
    const { data: byTaskId } = await service
      .from('clips')
      .select('*, jobs(*)')
      .eq('task_id', task_id)
      .maybeSingle()
    clip = byTaskId
  }

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

// Probe common font locations (Linux/macOS/Vercel)
const FONT_CANDIDATES = [
  // Linux / Vercel
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf',
  // macOS
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
]
let _resolvedFont: string | null | undefined = undefined  // undefined = not probed yet

function findFont(): string | null {
  if (_resolvedFont !== undefined) return _resolvedFont
  for (const p of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p)) { _resolvedFont = p; return p }
    } catch { /* ignore */ }
  }
  _resolvedFont = null
  return null
}

/**
 * Build a drawtext ffmpeg filter string.
 * Returns null if no system font is available (subtitle is silently skipped).
 */
function buildDrawtext(text: string, yOffset = 80): string | null {
  const fontFile = findFont()
  const safeText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .slice(0, 120)  // cap length to avoid overflow

  const fontPart = fontFile ? `fontfile=${fontFile}:` : ''
  return (
    `drawtext=${fontPart}` +
    `text='${safeText}':fontcolor=white:fontsize=30:` +
    `borderw=2:bordercolor=black@0.8:` +
    `x=(w-text_w)/2:y=h-${yOffset}`
  )
}

/**
 * Compose a PiP clip: diagram image as full-screen background + character clip
 * in the bottom-right corner. Burns subtitle text from the dialogue.
 *
 * Layout (9:16 video at 1080×1920):
 *   - Background: diagram image scaled to fill the frame
 *   - PiP: character clip at 28% width, bottom-right, 20px margin
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
  const pipW = Math.round(baseW * 0.28)
  const pipX = baseW - pipW - 20
  const pipY = baseH - Math.round(pipW * parseInt(hStr) / parseInt(wStr)) - 110

  const subtitleFilter = dialogue.trim() ? buildDrawtext(dialogue) : null

  if (diagramImagePath) {
    // Full PiP: diagram bg + character overlay + subtitle
    const filters: string[] = [
      `[0:v]scale=${baseW}:${baseH},setsar=1[bg]`,
      `[1:v]scale=${pipW}:-2[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}${subtitleFilter ? '[composed]' : '[out]'}`,
    ]
    if (subtitleFilter) {
      filters.push(`[composed]${subtitleFilter}[out]`)
    }

    await runFfmpeg(
      ffmpeg()
        .input(diagramImagePath)
        .inputOptions(['-loop', '1'])
        .input(characterVideoPath)
        .complexFilter(filters.join(';'), 'out')
        .outputOptions([
          '-map', '[out]',
          '-map', '1:a?',
          '-c:v', 'libx264',
          '-crf', '23',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-shortest',
        ])
        .output(outputPath),
    )
  } else {
    // No diagram: optionally burn subtitle on character clip
    if (!subtitleFilter) {
      // Nothing to do — just copy the file
      fs.copyFileSync(characterVideoPath, outputPath)
      return
    }
    const filterComplex = `[0:v]${subtitleFilter}[out]`

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
