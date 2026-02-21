import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus, submitMultiShotVideo } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'
import { createLogger } from '@/lib/logger'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const logger = createLogger('webhook:kling')

// POST /api/webhooks/kling — Kling 回调
//
// 安全：callback URL 携带 ?whs=<KLING_WEBHOOK_SECRET>，此处校验。
// 防止任意方伪造 task_id 触发大量 Kling API 查询。
export async function POST(request: NextRequest) {
  // ── Webhook secret 校验 ──────────────────────────────────────────────────
  const webhookSecret = process.env.KLING_WEBHOOK_SECRET
  if (webhookSecret) {
    const incoming = request.nextUrl.searchParams.get('whs')
    if (incoming !== webhookSecret) {
      logger.warn('webhook secret mismatch — rejected')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json()
  const task_id = body?.data?.task_id || body?.task_id
  if (!task_id) return NextResponse.json({ ok: true })

  logger.info('callback received', { task_id })

  // 立即响应防止 Kling 重试；handleCallback 在背景继续
  handleCallback(task_id).catch(err =>
    logger.error('handleCallback failed', { task_id, err: String(err) })
  )

  return NextResponse.json({ ok: true })
}

async function handleCallback(task_id: string) {
  const service = await createServiceClient()

  // 先查 kling_task_id，找不到再查统一 task_id 字段
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
    await service.from('clips')
      .update({ status: 'failed', error_msg: task.task_status_msg })
      .eq('id', clip.id)
    await checkAndUpdateJobStatus(service, clip.job_id)
    return
  }

  if (task.task_status === 'succeed') {
    const videoUrl = task.task_result?.videos?.[0]?.url
    if (!videoUrl) return

    const buffer = Buffer.from(await (await fetch(videoUrl)).arrayBuffer())
    const key = `jobs/${clip.job_id}/clips/${clip.clip_index}.mp4`
    const r2Url = await uploadToR2(key, buffer, 'video/mp4')

    await service.from('clips').update({
      status: 'done',
      video_url: r2Url,
      lipsync_url: r2Url,
    }).eq('id', clip.id)

    logger.info('clip uploaded', { task_id, jobId: clip.job_id, clipIndex: clip.clip_index })

    // Frame chaining: if the job has a deferred next clip, extract last frame
    // and submit it now with that frame as first_frame anchor.
    await submitNextDeferredClip(service, clip.job_id, clip.clip_index, buffer)

    await checkAndUpdateJobStatus(service, clip.job_id)
  }
}

// ── Frame chaining helpers ────────────────────────────────────────────────────

/**
 * Extract the last frame of an MP4 buffer using ffmpeg-static.
 * Returns the frame as a JPEG buffer, or null on failure.
 */
async function extractLastFrame(videoBuffer: Buffer): Promise<Buffer | null> {
  const tmpDir = path.join(os.tmpdir(), `dreamlab_frame_${Date.now()}`)
  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    const videoPath = path.join(tmpDir, 'clip.mp4')
    const framePath = path.join(tmpDir, 'last_frame.jpg')
    fs.writeFileSync(videoPath, videoBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        // sseof: seek from end of file; -0.5s catches the last real frame
        .inputOptions(['-sseof', '-0.5'])
        .outputOptions(['-vframes', '1', '-q:v', '2'])
        .output(framePath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run()
    })

    if (!fs.existsSync(framePath)) return null
    return fs.readFileSync(framePath)
  } catch (err) {
    logger.warn('extractLastFrame failed (non-fatal)', { err: String(err) })
    return null
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

/**
 * After clip N completes, look for the next pending deferred clip (clip N+1).
 * If found, extract the last frame of clip N, use it as first_frame for clip N+1,
 * and submit it to Kling. The deferred payload is stored in clips.prompt as JSON.
 */
async function submitNextDeferredClip(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  jobId: number,
  completedClipIndex: number,
  completedVideoBuffer: Buffer,
): Promise<void> {
  const nextIndex = completedClipIndex + 1

  // Find the next clip — must be pending with a deferred payload
  const { data: nextClip } = await service
    .from('clips')
    .select('id, prompt')
    .eq('job_id', jobId)
    .eq('clip_index', nextIndex)
    .eq('status', 'pending')
    .maybeSingle()

  if (!nextClip) return

  let deferred: Record<string, unknown>
  try {
    deferred = JSON.parse(nextClip.prompt ?? '{}')
  } catch {
    return
  }
  if (!deferred._deferred) return

  logger.info('frame chain: submitting deferred clip', { jobId, nextIndex })

  // Extract last frame and upload to R2
  const frameBuffer = await extractLastFrame(completedVideoBuffer)
  let firstFrameUrl: string | undefined

  if (frameBuffer) {
    const frameKey = `jobs/${jobId}/frames/clip_${completedClipIndex}_last.jpg`
    firstFrameUrl = await uploadToR2(frameKey, frameBuffer, 'image/jpeg')
    // Store the extracted frame in the completing clip's first_frame_url for reference
    await service.from('clips').update({ first_frame_url: firstFrameUrl }).eq('job_id', jobId).eq('clip_index', completedClipIndex)
  }

  // Build submitMultiShotVideo params from deferred payload
  const elementList = deferred.elementList as Array<{ element_id?: string; frontal_image_url?: string }> | undefined
  const voiceList = deferred.voiceList as Array<{ voice_id: string }> | undefined

  const baseParams = {
    imageUrl: deferred.imageUrl as string,
    totalDuration: deferred.totalDuration as number,
    aspectRatio: deferred.aspectRatio as string,
    callbackUrl: deferred.callbackUrl as string,
    firstFrameUrl,  // the chain anchor
    elementList,
    voiceList,
  }

  let resp: unknown
  if (deferred.kind === 'single') {
    resp = await submitMultiShotVideo({
      ...baseParams,
      prompt: deferred.prompt as string,
      shotType: deferred.shotType as 'intelligence' | 'customize',
    })
  } else {
    resp = await submitMultiShotVideo({
      ...baseParams,
      shots: deferred.shots as Array<{ index: number; prompt: string; duration: number }>,
      shotType: 'customize',
    })
  }

  const taskId = (resp as { data?: { task_id?: string } })?.data?.task_id ?? null
  if (taskId) {
    await service.from('clips')
      .update({
        status: 'submitted',
        provider: 'kling',
        kling_task_id: taskId,
        task_id: taskId,
        first_frame_url: firstFrameUrl ?? null,
        prompt: deferred.prompt as string ?? '',
      })
      .eq('id', nextClip.id)
    logger.info('frame chain: deferred clip submitted', { jobId, nextIndex, taskId })
  } else {
    await service.from('clips')
      .update({ status: 'failed', error_msg: 'Deferred submission failed' })
      .eq('id', nextClip.id)
    logger.warn('frame chain: deferred clip submission failed', { jobId, nextIndex })
  }
}

async function checkAndUpdateJobStatus(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  jobId: number,
) {
  const { data: clips } = await service.from('clips').select('status').eq('job_id', jobId)
  if (!clips) return

  const allDone     = clips.every(c => c.status === 'done')
  const allTerminal = clips.every(c => c.status === 'done' || c.status === 'failed')
  const anyFailed   = clips.some(c => c.status === 'failed')

  // Count successful clips
  const doneCount = clips.filter(c => c.status === 'done').length

  if (allTerminal && anyFailed && doneCount === 0) {
    // All clips failed → job failed, refund credits
    const { data: job } = await service
      .from('jobs')
      .select('user_id, credit_cost')
      .eq('id', jobId)
      .single()

    await service.from('jobs')
      .update({ status: 'failed', error_msg: 'clip generation failed' })
      .eq('id', jobId)

    if (job?.user_id && job.credit_cost > 0) {
      ;(async () => {
        const { error } = await service.rpc('add_credits', {
          p_user_id: job.user_id,
          p_amount: job.credit_cost,
          p_reason: `refund:job_failed:${jobId}`,
        })
        if (error) logger.error('refund failed', { jobId, err: error.message })
        else logger.info('credits refunded', { jobId, amount: job.credit_cost })
      })()
    }
    return
  }

  // Partial success: some clips done, some failed → still stitch what we have
  if (allTerminal && doneCount > 0) {
    await service.from('jobs').update({ status: 'stitching' }).eq('id', jobId)

    // 触发独立的 stitch 路由（maxDuration=300）— fire-and-forget
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/jobs/${jobId}/stitch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-stitch-secret': process.env.RECOVER_SECRET ?? '',
      },
    }).catch(err => logger.error('failed to trigger stitch', { jobId, err: String(err) }))
  }
}
