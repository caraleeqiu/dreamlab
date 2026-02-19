import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTaskStatus } from '@/lib/kling'
import { uploadToR2 } from '@/lib/r2'
import { createLogger } from '@/lib/logger'

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
    await checkAndUpdateJobStatus(service, clip.job_id)
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

  if (allTerminal && anyFailed && !allDone) {
    // All clips are terminal and at least one failed → job failed, refund credits
    const { data: job } = await service
      .from('jobs')
      .select('user_id, credit_cost')
      .eq('id', jobId)
      .single()

    await service.from('jobs')
      .update({ status: 'failed', error_msg: '部分切片生成失败' })
      .eq('id', jobId)

    if (job?.user_id && job.credit_cost > 0) {
      service.rpc('add_credits', {
        p_user_id: job.user_id,
        p_amount: job.credit_cost,
        p_reason: `refund:job_failed:${jobId}`,
      }).then(() => logger.info('credits refunded', { jobId, amount: job.credit_cost }))
        .catch(err => logger.error('refund failed', { jobId, err: String(err) }))
    }
    return
  }

  if (allDone) {
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
