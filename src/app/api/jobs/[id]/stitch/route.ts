import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { createLogger } from '@/lib/logger'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const logger = createLogger('jobs:stitch')

// Vercel Pro: up to 300s execution time for this route
// Hobby plan: capped at 60s — upgrade required for long videos
export const maxDuration = 300
export const runtime = 'nodejs'

const STITCH_SECRET = process.env.RECOVER_SECRET

// POST /api/jobs/[id]/stitch
// Triggered by webhook when all clips are done.
// Protected by same x-stitch-secret as recover route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (STITCH_SECRET) {
    const secret = request.headers.get('x-stitch-secret')
    if (secret !== STITCH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { id } = await params
  const jobId = parseInt(id, 10)
  if (isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })

  const service = await createServiceClient()
  await stitchVideo(service, jobId)
  return NextResponse.json({ ok: true })
}

// ─── ffmpeg helpers ───────────────────────────────────────────────────────────

function runFfmpeg(cmd: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd.on('end', () => resolve()).on('error', (err: Error) => reject(err)).run()
  })
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err)
      else resolve((meta.format.duration as number | undefined) ?? 0)
    })
  })
}

/**
 * Concat clips with 0.3s crossfade (xfade + acrossfade) for a polished cut.
 * Falls back to hard concat if xfade fails (codec mismatch, very short clips, etc).
 */
async function crossfadeConcat(inputPaths: string[], outputPath: string, tmpDir: string): Promise<void> {
  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath)
    return
  }

  const FADE = 0.3

  try {
    // Normalize all clips to consistent libx264/aac so xfade filter works
    const normPaths = await Promise.all(inputPaths.map(async (p, i) => {
      const normPath = path.join(tmpDir, `norm_${i}.mp4`)
      await runFfmpeg(
        ffmpeg().input(p)
          .outputOptions([
            '-vf', 'scale=1080:-2,fps=24,format=yuv420p',
            '-c:v', 'libx264', '-crf', '22', '-preset', 'fast',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
          ])
          .output(normPath),
      )
      return normPath
    }))

    const durations = await Promise.all(normPaths.map(getVideoDuration))

    // Build xfade + acrossfade filter chain
    const filters: string[] = []
    let cumulativeDur = 0

    for (let i = 1; i < normPaths.length; i++) {
      const vPrev = i === 1 ? '[0:v]' : `[vx${i - 1}]`
      const aPrev = i === 1 ? '[0:a]' : `[ax${i - 1}]`
      const isLast = i === normPaths.length - 1
      const vOut = isLast ? '[vout]' : `[vx${i}]`
      const aOut = isLast ? '[aout]' : `[ax${i}]`

      cumulativeDur += durations[i - 1]
      const offset = Math.max(0, cumulativeDur - FADE * i)

      filters.push(`${vPrev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${vOut}`)
      filters.push(`${aPrev}[${i}:a]acrossfade=d=${FADE}${aOut}`)
    }

    const cmd = ffmpeg()
    for (const p of normPaths) cmd.input(p)

    await runFfmpeg(
      cmd
        .complexFilter(filters, ['vout', 'aout'])
        .outputOptions(['-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-c:a', 'aac'])
        .output(outputPath),
    )
    logger.info('crossfade concat complete', { clips: normPaths.length })
  } catch (err) {
    // Fallback: hard concat
    logger.warn('crossfade failed, falling back to hard concat', { err: String(err) })
    const listPath = path.join(tmpDir, 'concat_fallback.txt')
    fs.writeFileSync(listPath, inputPaths.map(p => `file '${p}'`).join('\n'))
    await runFfmpeg(
      ffmpeg().input(listPath).inputOptions(['-f', 'concat', '-safe', '0']).outputOptions(['-c', 'copy']).output(outputPath),
    )
  }
}

const FONT_CANDIDATES = [
  // Bundled font — available on all platforms including Vercel
  path.join(process.cwd(), 'public/fonts/NotoSansSC-Regular.ttf'),
  // Linux system fonts
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  // macOS system fonts (CJK capable)
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Medium.ttc',
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
]
let _resolvedFont: string | null | undefined = undefined

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

function buildDrawtext(text: string, yOffset = 80): string | null {
  const fontFile = findFont()
  if (!fontFile) return null   // skip subtitle if no font available — avoids broken glyphs
  const safeText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\n/g, ' ')
    .slice(0, 160)
  return (
    `drawtext=fontfile=${fontFile}:` +
    `text='${safeText}':fontcolor=white:fontsize=34:` +
    `borderw=3:bordercolor=black@0.85:` +
    `box=1:boxcolor=black@0.35:boxborderw=8:` +
    `x=(w-text_w)/2:y=h-${yOffset}:` +
    `line_spacing=8`
  )
}

async function composePipClip(opts: {
  characterVideoPath: string
  diagramImagePath: string | null
  outputPath: string
  dialogue: string
  aspectRatio: string
}): Promise<void> {
  const { characterVideoPath, diagramImagePath, outputPath, dialogue, aspectRatio } = opts
  const [wStr, hStr] = aspectRatio.split(':')
  const baseW = 1080
  const baseH = Math.round(baseW * parseInt(hStr) / parseInt(wStr))
  const pipW = Math.round(baseW * 0.28)
  const pipX = baseW - pipW - 20
  const pipY = baseH - Math.round(pipW * parseInt(hStr) / parseInt(wStr)) - 110
  const subtitleFilter = dialogue.trim() ? buildDrawtext(dialogue) : null

  if (diagramImagePath) {
    const filters: string[] = [
      `[0:v]scale=${baseW}:${baseH},setsar=1[bg]`,
      `[1:v]scale=${pipW}:-2[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}${subtitleFilter ? '[composed]' : '[out]'}`,
    ]
    if (subtitleFilter) filters.push(`[composed]${subtitleFilter}[out]`)

    await runFfmpeg(
      ffmpeg()
        .input(diagramImagePath).inputOptions(['-loop', '1'])
        .input(characterVideoPath)
        .complexFilter(filters.join(';'), 'out')
        .outputOptions(['-map', '[out]', '-map', '1:a?', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac', '-shortest'])
        .output(outputPath),
    )
  } else {
    if (!subtitleFilter) { fs.copyFileSync(characterVideoPath, outputPath); return }
    await runFfmpeg(
      ffmpeg()
        .input(characterVideoPath)
        .complexFilter(`[0:v]${subtitleFilter}[out]`, 'out')
        .outputOptions(['-map', '[out]', '-map', '0:a?', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac'])
        .output(outputPath),
    )
  }
}

async function stitchVideo(service: Awaited<ReturnType<typeof createServiceClient>>, jobId: number) {
  const { data: job } = await service.from('jobs').select('metadata, script, user_id, credit_cost').eq('id', jobId).single()
  const { data: clips } = await service.from('clips').select('lipsync_url, video_url, clip_index').eq('job_id', jobId).order('clip_index')

  if (!clips?.length) {
    await service.from('jobs').update({ status: 'failed', error_msg: 'No clips to stitch' }).eq('id', jobId)
    await refundCredits(service, job)
    return
  }

  // Splice mode: 3-part concat [before + generated_clip + after]
  const isSplice = job?.metadata?.splice_mode === true
  if (isSplice) {
    const beforeUrl: string | null = job.metadata.splice_before_url ?? null
    const afterUrl: string | null = job.metadata.splice_after_url ?? null
    const generatedClip = clips[0]?.lipsync_url || clips[0]?.video_url || null
    if (!generatedClip) {
      await service.from('jobs').update({ status: 'failed', error_msg: 'No generated clip for splice' }).eq('id', jobId)
      return
    }
    const parts: string[] = []
    const spliceDir = path.join(os.tmpdir(), `dreamlab_splice_${jobId}_${Date.now()}`)
    fs.mkdirSync(spliceDir, { recursive: true })

    const downloadPart = async (url: string, name: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const p = path.join(spliceDir, name)
      fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()))
      return p
    }

    if (beforeUrl) { const p = await downloadPart(beforeUrl, 'before.mp4'); if (p) parts.push(p) }
    const genPath = await downloadPart(generatedClip, 'generated.mp4')
    if (genPath) parts.push(genPath)
    if (afterUrl) { const p = await downloadPart(afterUrl, 'after.mp4'); if (p) parts.push(p) }

    if (!parts.length) {
      await service.from('jobs').update({ status: 'failed', error_msg: 'Splice parts unavailable' }).eq('id', jobId)
      return
    }

    const finalPath = path.join(spliceDir, 'final.mp4')
    await crossfadeConcat(parts, finalPath, spliceDir)
    const splicedUrl = await uploadToR2(`jobs/${jobId}/final.mp4`, fs.readFileSync(finalPath), 'video/mp4')

    // Update the original job's final video too
    const origJobId: number | null = job.metadata.original_job_id ?? null
    if (origJobId) {
      await service.from('jobs').update({ final_video_url: splicedUrl }).eq('id', origJobId)
    }
    await service.from('jobs').update({ status: 'done', final_video_url: splicedUrl, updated_at: new Date().toISOString() }).eq('id', jobId)
    logger.info('splice stitch complete', { jobId, splicedUrl })
    try { fs.rmSync(spliceDir, { recursive: true, force: true }) } catch {}
    return
  }

  const isPaper = job?.metadata?.sub_type === 'paper'
  const diagramUrls: string[][] = isPaper ? (job?.metadata?.diagram_urls ?? []) : []
  const scriptClips: Array<{ dialogue?: string; diagram_index?: number }> = job?.script ?? []

  // Fast path: single clip, no PiP
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

    for (const clip of clips) {
      const res = await fetch(clip.lipsync_url)
      if (!res.ok) throw new Error(`Failed to download clip ${clip.clip_index}: ${res.status}`)
      fs.writeFileSync(path.join(tmpDir, `clip_${clip.clip_index}.mp4`), Buffer.from(await res.arrayBuffer()))
    }

    let processedPaths: string[]

    if (isPaper) {
      processedPaths = await Promise.all(clips.map(async clip => {
        const scriptClip = scriptClips[clip.clip_index] ?? {}
        const diagIdx = scriptClip.diagram_index ?? clip.clip_index
        const diagImgUrl = (diagramUrls[diagIdx] ?? [])[0] ?? null
        let diagImgPath: string | null = null
        if (diagImgUrl) {
          try {
            const imgRes = await fetch(diagImgUrl)
            if (imgRes.ok) {
              diagImgPath = path.join(tmpDir, `diag_${clip.clip_index}.jpg`)
              fs.writeFileSync(diagImgPath, Buffer.from(await imgRes.arrayBuffer()))
            }
          } catch { /* non-fatal */ }
        }
        const composedPath = path.join(tmpDir, `composed_${clip.clip_index}.mp4`)
        await composePipClip({
          characterVideoPath: path.join(tmpDir, `clip_${clip.clip_index}.mp4`),
          diagramImagePath: diagImgPath,
          outputPath: composedPath,
          dialogue: scriptClip.dialogue ?? '',
          aspectRatio: '9:16',
        })
        return composedPath
      }))
    } else {
      processedPaths = await Promise.all(clips.map(async clip => {
        const dialogue = (scriptClips[clip.clip_index] ?? {}).dialogue ?? ''
        if (!dialogue) return path.join(tmpDir, `clip_${clip.clip_index}.mp4`)
        const outputPath = path.join(tmpDir, `sub_${clip.clip_index}.mp4`)
        await composePipClip({
          characterVideoPath: path.join(tmpDir, `clip_${clip.clip_index}.mp4`),
          diagramImagePath: null,
          outputPath,
          dialogue,
          aspectRatio: '9:16',
        })
        return outputPath
      }))
    }

    const finalPath = path.join(tmpDir, 'final.mp4')
    await crossfadeConcat(processedPaths, finalPath, tmpDir)

    const finalUrl = await uploadToR2(`jobs/${jobId}/final.mp4`, fs.readFileSync(finalPath), 'video/mp4')
    await service.from('jobs').update({ status: 'done', final_video_url: finalUrl, updated_at: new Date().toISOString() }).eq('id', jobId)
    logger.info('stitch complete', { jobId, finalUrl })

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

// Refund credits when a job ends in hard failure (no clips succeeded)
async function refundCredits(service: Awaited<ReturnType<typeof createServiceClient>>, job: { user_id: string; credit_cost: number } | null) {
  if (!job?.user_id || !job.credit_cost) return
  try {
    await service.rpc('add_credits', {
      p_user_id: job.user_id,
      p_amount: job.credit_cost,
      p_reason: 'refund:stitch_failed',
    })
    logger.info('credits refunded', { userId: job.user_id, amount: job.credit_cost })
  } catch (err) {
    logger.error('credit refund failed', { err: String(err) })
  }
}
