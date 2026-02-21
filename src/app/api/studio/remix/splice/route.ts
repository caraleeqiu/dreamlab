import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { getPresignedUrl, uploadToR2 } from '@/lib/r2'
import { getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import type { Influencer } from '@/types'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { createLogger } from '@/lib/logger'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
const logger = createLogger('remix:splice')

export const maxDuration = 300
export const runtime = 'nodejs'

function runFfmpeg(cmd: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd.on('end', () => resolve()).on('error', (err: Error) => reject(err)).run()
  })
}

function getVideoDuration(p: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(p, (err, meta) => {
      if (err) reject(err)
      else resolve((meta.format.duration as number | undefined) ?? 0)
    })
  })
}

// POST /api/studio/remix/splice
//
// Scenario ②: Replace a time segment [startS, endS] in an existing job's final video.
//
// Two modes:
//   replacementType: 'ai-generate'  → Kling generates the replacement segment
//   replacementType: 'upload-clip'  → user provides a direct video URL (splice immediately)
//
// For 'ai-generate': creates a 1-clip job; stores splice metadata; webhook stitch handles 3-part concat.
// For 'upload-clip':  downloads, FFmpeg splice, re-upload — done synchronously.
//
// Body: {
//   jobId: number                       // original job whose final video we're splicing into
//   startS: number                      // segment start in seconds
//   endS: number                        // segment end in seconds (must be > startS)
//   replacementType: 'ai-generate' | 'upload-clip'
//   prompt?: string                     // for ai-generate
//   clipUrl?: string                    // for upload-clip
// }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const body = await req.json()
  const { jobId, startS, endS, replacementType, prompt, clipUrl } = body as {
    jobId: number
    startS: number
    endS: number
    replacementType: 'ai-generate' | 'upload-clip'
    prompt?: string
    clipUrl?: string
  }

  if (!jobId || startS === undefined || !endS || endS <= startS) {
    return apiError('Missing or invalid splice parameters', 400)
  }
  if (replacementType === 'ai-generate' && !prompt) return apiError('Missing prompt for ai-generate', 400)
  if (replacementType === 'upload-clip' && !clipUrl) return apiError('Missing clipUrl for upload-clip', 400)

  const service = await createServiceClient()
  const { data: originalJob } = await service
    .from('jobs')
    .select('final_video_url, user_id, influencer_ids, aspect_ratio, language')
    .eq('id', jobId)
    .single()

  if (!originalJob?.final_video_url) return apiError('Job has no final video', 404)
  if (originalJob.user_id !== user.id) return apiError('Forbidden', 403)

  const segmentDuration = endS - startS
  const aspectRatio = originalJob.aspect_ratio || '9:16'
  const lang = originalJob.language || 'zh'

  const tmpDir = path.join(os.tmpdir(), `splice_${jobId}_${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    // Download original final video
    const origRes = await fetch(originalJob.final_video_url, { signal: AbortSignal.timeout(30_000) })
    if (!origRes.ok) return apiError('Cannot fetch original video', 400)
    const origPath = path.join(tmpDir, 'original.mp4')
    fs.writeFileSync(origPath, Buffer.from(await origRes.arrayBuffer()))

    const totalDur = await getVideoDuration(origPath)
    const safeEnd = Math.min(endS, totalDur)
    const safeStart = Math.max(0, startS)

    // Extract BEFORE segment [0, startS]
    const beforePath = path.join(tmpDir, 'before.mp4')
    if (safeStart > 0) {
      await runFfmpeg(
        ffmpeg(origPath)
          .outputOptions(['-t', String(safeStart), '-c', 'copy'])
          .output(beforePath),
      )
    }

    // Extract AFTER segment [endS, total]
    const afterPath = path.join(tmpDir, 'after.mp4')
    if (safeEnd < totalDur) {
      await runFfmpeg(
        ffmpeg(origPath)
          .inputOptions(['-ss', String(safeEnd)])
          .outputOptions(['-c', 'copy'])
          .output(afterPath),
      )
    }

    if (replacementType === 'upload-clip') {
      // ── Synchronous path: download user clip + FFmpeg concat ─────────────────
      const clipRes = await fetch(clipUrl!, { signal: AbortSignal.timeout(20_000) })
      if (!clipRes.ok) return apiError('Cannot fetch replacement clip', 400)
      const replPath = path.join(tmpDir, 'replacement.mp4')
      fs.writeFileSync(replPath, Buffer.from(await clipRes.arrayBuffer()))

      // Normalize replacement to match original video format
      const normPath = path.join(tmpDir, 'repl_norm.mp4')
      await runFfmpeg(
        ffmpeg(replPath)
          .outputOptions(['-vf', 'scale=1080:-2,fps=24,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-c:a', 'aac', '-ar', '44100', '-ac', '2'])
          .output(normPath),
      )

      // Build concat list
      const parts: string[] = []
      if (fs.existsSync(beforePath)) parts.push(beforePath)
      parts.push(normPath)
      if (fs.existsSync(afterPath)) parts.push(afterPath)

      const listPath = path.join(tmpDir, 'concat.txt')
      fs.writeFileSync(listPath, parts.map(p => `file '${p}'`).join('\n'))

      const finalPath = path.join(tmpDir, 'spliced.mp4')
      await runFfmpeg(
        ffmpeg().input(listPath).inputOptions(['-f', 'concat', '-safe', '0']).outputOptions(['-c', 'copy']).output(finalPath),
      )

      const splicedUrl = await uploadToR2(`jobs/${jobId}/spliced_${Date.now()}.mp4`, fs.readFileSync(finalPath), 'video/mp4')
      await service.from('jobs').update({ final_video_url: splicedUrl }).eq('id', jobId)

      logger.info('splice (upload-clip) complete', { jobId, splicedUrl })
      return NextResponse.json({ jobId, splicedUrl })
    }

    // ── AI-generate path: create a sub-job for the replacement segment ────────
    // Upload before/after parts to R2 so the stitch webhook can access them
    const beforeUrl = fs.existsSync(beforePath)
      ? await uploadToR2(`splice/${jobId}/before_${Date.now()}.mp4`, fs.readFileSync(beforePath), 'video/mp4')
      : null
    const afterUrl = fs.existsSync(afterPath)
      ? await uploadToR2(`splice/${jobId}/after_${Date.now()}.mp4`, fs.readFileSync(afterPath), 'video/mp4')
      : null

    // Get influencer for the generation
    const infId = originalJob.influencer_ids?.[0]
    const { data: influencer } = await service
      .from('influencers').select('*').eq('id', infId).maybeSingle()
    const inf = influencer as Influencer | null

    const frontalKey = inf?.frontal_image_url?.split('/dreamlab-assets/')[1]
    const imageUrl = frontalKey ? await getPresignedUrl(frontalKey) : inf?.frontal_image_url || ''

    // Only use element_list if influencer has a registered element_id
    // Kling API does not support frontal_image_url as fallback in element_list
    const elementList = inf?.kling_element_id
      ? [{ element_id: inf.kling_element_id }]
      : undefined
    const voiceList = inf?.kling_element_voice_id
      ? [{ voice_id: inf.kling_element_voice_id }]
      : undefined

    const callbackUrl = getCallbackUrl()

    // Create splice sub-job
    const { data: spliceJob, error: spliceErr } = await supabase.from('jobs').insert({
      user_id: user.id,
      type: 'remix',
      status: 'generating',
      language: lang,
      title: lang === 'en' ? `Splice: ${prompt!.slice(0, 40)}` : `片段替换: ${prompt!.slice(0, 40)}`,
      aspect_ratio: aspectRatio,
      influencer_ids: infId ? [infId] : [],
      script: [{ index: 0, speaker: inf?.slug || '', dialogue: '', shot_description: prompt!, duration: Math.round(segmentDuration) }],
      credit_cost: 0,  // Splice: no extra credit (already paid for original)
      metadata: {
        splice_mode: true,
        original_job_id: jobId,
        splice_before_url: beforeUrl,
        splice_after_url: afterUrl,
      },
    }).select().single()

    if (spliceErr || !spliceJob) return apiError(spliceErr?.message ?? 'Failed to create splice job', 500)

    await service.from('clips').insert({
      job_id: spliceJob.id, clip_index: 0, status: 'pending', prompt: prompt, provider: 'kling',
    })

    // Submit replacement to Kling
    const resp = await submitMultiShotVideo({
      imageUrl,
      prompt: `${prompt} natural micro-movements, realistic breathing.`,
      shotType: 'intelligence',
      totalDuration: Math.min(segmentDuration, 15),
      aspectRatio,
      elementList,
      voiceList,
      callbackUrl,
    })

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', provider: 'kling', kling_task_id: result.taskId, task_id: result.taskId })
        .eq('job_id', spliceJob.id).eq('clip_index', 0)
    } else {
      await service.from('clips').update({ status: 'failed', error_msg: result.error }).eq('job_id', spliceJob.id).eq('clip_index', 0)
      await service.from('jobs').update({ status: 'failed' }).eq('id', spliceJob.id)
    }

    return NextResponse.json({ jobId: spliceJob.id, spliceMode: true })
  } catch (err) {
    logger.error('splice failed', { jobId, err: String(err) })
    return apiError(`Splice failed: ${(err as Error).message}`, 500)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
