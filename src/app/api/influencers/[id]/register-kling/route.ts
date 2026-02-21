import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createSubject } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { apiError } from '@/lib/api-response'
import type { Influencer } from '@/types'

// POST /api/influencers/[id]/register-kling
// Registers the influencer in Kling's Subject Library (v1/general/advanced-custom-elements).
// On success, saves kling_element_id + kling_element_voice_id back to DB.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { id } = await params
  const infId = parseInt(id, 10)
  if (isNaN(infId)) return apiError('Invalid influencer id', 400)

  const service = await createServiceClient()
  const { data: raw } = await service.from('influencers').select('*').eq('id', infId).single()
  if (!raw) return apiError('Influencer not found', 404)

  const inf = raw as Influencer

  // Only owner or admin can register
  if (inf.user_id && inf.user_id !== user.id) return apiError('Forbidden', 403)

  // Already registered
  if (inf.kling_element_id) {
    return NextResponse.json({
      element_id: inf.kling_element_id,
      voice_id: inf.kling_element_voice_id,
      already_registered: true,
    })
  }

  if (!inf.frontal_image_url) return apiError('Influencer has no frontal image', 400)

  // Resolve presigned URL for the frontal image
  const frontalKey = inf.frontal_image_url.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url

  // Call Kling Subject Library API
  const result = await createSubject({
    name: inf.slug,
    description: inf.tagline || `AI influencer: ${inf.name}`,
    imageUrls: [imageUrl],
  })

  if (!result?.element_id) {
    const errMsg = result?.error || 'Unknown error'
    console.error('[register-kling] Failed for', inf.slug, ':', errMsg, 'imageUrl:', imageUrl.slice(0, 100))
    return apiError(`Kling registration failed: ${errMsg}`, 500)
  }

  // Save element_id + voice_id back to DB
  await service.from('influencers').update({
    kling_element_id: result.element_id,
    kling_element_voice_id: result.voice_id ?? null,
  }).eq('id', infId)

  return NextResponse.json({
    element_id: result.element_id,
    voice_id: result.voice_id,
    already_registered: false,
  })
}
