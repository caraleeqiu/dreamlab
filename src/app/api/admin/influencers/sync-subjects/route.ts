import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createSubject } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { createLogger } from '@/lib/logger'
import type { Influencer } from '@/types'

const logger = createLogger('admin:sync-subjects')
const ADMIN_SECRET = process.env.RECOVER_SECRET // reuse same secret

// POST /api/admin/influencers/sync-subjects
//
// Registers all influencers that lack a kling_element_id into Kling's
// Subject Library, then writes back element_id + voice_id to the DB.
//
// Designed to be called once after DB migration, or again for new influencers.
// Protected by the same x-recover-secret header as the recovery route.
//
// Optional body: { influencer_ids: number[] }  — limit to specific IDs
export async function POST(request: NextRequest) {
  if (ADMIN_SECRET) {
    const secret = request.headers.get('x-recover-secret')
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json().catch(() => ({}))
  const targetIds: number[] | undefined = body.influencer_ids

  const service = await createServiceClient()

  let query = service
    .from('influencers')
    .select('*')
    .is('kling_element_id', null)

  if (targetIds?.length) {
    query = query.in('id', targetIds)
  }

  const { data: influencers, error } = await query

  if (error) {
    logger.error('failed to query influencers', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!influencers?.length) {
    logger.info('all influencers already registered')
    return NextResponse.json({ registered: 0, skipped: 0 })
  }

  logger.info('registering influencers', { count: influencers.length })

  const results = await Promise.allSettled(
    (influencers as Influencer[]).map(async (inf) => {
      if (!inf.frontal_image_url) {
        return { id: inf.id, name: inf.name, skipped: true, reason: 'no frontal_image_url' }
      }

      // Get a presigned R2 URL so Kling can fetch the image
      const key = inf.frontal_image_url.split('/dreamlab-assets/')[1]
      const imageUrl = key ? await getPresignedUrl(key) : inf.frontal_image_url

      const result = await createSubject({
        name: inf.name,
        imageUrls: [imageUrl],
      })

      if (!result) {
        return { id: inf.id, name: inf.name, skipped: false, success: false, reason: 'createSubject returned null' }
      }

      await service
        .from('influencers')
        .update({
          kling_element_id: result.element_id,
          ...(result.voice_id && { kling_element_voice_id: result.voice_id }),
        })
        .eq('id', inf.id)

      logger.info('registered', { id: inf.id, name: inf.name, element_id: result.element_id })
      return { id: inf.id, name: inf.name, skipped: false, success: true, element_id: result.element_id }
    })
  )

  const rows = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: String((r as PromiseRejectedResult).reason) })
  const succeeded = rows.filter(r => r.success).length
  const skipped   = rows.filter(r => 'skipped' in r && r.skipped).length
  const failed    = rows.filter(r => !r.success && !('skipped' in r && r.skipped)).length

  logger.info('sync complete', { total: influencers.length, succeeded, skipped, failed })

  return NextResponse.json({ total: influencers.length, succeeded, skipped, failed, rows })
}
