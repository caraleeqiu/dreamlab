import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('jobs:recover')

// POST /api/jobs/recover
//
// Finds clips stuck in 'submitted' for longer than STALE_MINUTES and re-triggers
// Kling status checks by simulating a webhook callback for each one.
//
// Designed to be called by a Supabase Cron Job every 10 minutes:
//   Schedule: */10 * * * *
//   Method:   POST
//   URL:      https://<your-app>/api/jobs/recover
//   Headers:  { "x-recover-secret": "<RECOVER_SECRET env var>" }
//
// Can also be triggered manually for debugging.

const STALE_MINUTES = 30
const RECOVER_SECRET = process.env.RECOVER_SECRET

export async function POST(request: NextRequest) {
  // Simple shared-secret auth — prevents public abuse
  if (RECOVER_SECRET) {
    const secret = request.headers.get('x-recover-secret')
    if (secret !== RECOVER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const service = await createServiceClient()
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()

  // Find clips that have been submitted but haven't heard back from Kling
  const { data: stuckClips, error } = await service
    .from('clips')
    .select('id, job_id, clip_index, kling_task_id')
    .eq('status', 'submitted')
    .not('kling_task_id', 'is', null)
    .lt('updated_at', cutoff)

  if (error) {
    logger.error('failed to query stuck clips', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!stuckClips?.length) {
    logger.info('no stuck clips found')
    return NextResponse.json({ recovered: 0 })
  }

  logger.warn('found stuck clips', { count: stuckClips.length, cutoff })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const webhookUrl = `${appUrl}/api/webhooks/kling`

  // Re-trigger Kling status check for each stuck clip by simulating a webhook callback.
  // The webhook handler already does the full succeed/fail/upload flow.
  const results = await Promise.allSettled(
    stuckClips.map(clip =>
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: clip.kling_task_id }),
      }).then(r => ({ clipId: clip.id, taskId: clip.kling_task_id, ok: r.ok }))
    )
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed    = results.filter(r => r.status === 'rejected').length

  logger.info('recovery complete', { total: stuckClips.length, succeeded, failed })

  return NextResponse.json({
    recovered: stuckClips.length,
    succeeded,
    failed,
  })
}
