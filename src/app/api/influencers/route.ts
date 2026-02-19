import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CREDIT_COSTS } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'
import { createSubject } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import { createLogger } from '@/lib/logger'

const logger = createLogger('influencers')

// GET /api/influencers — 拉取内置网红 + 当前用户自建网红
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .or(`is_builtin.eq.true,user_id.eq.${user.id}`)
    .order('is_builtin', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return NextResponse.json(data)
}

// POST /api/influencers — 创建用户自建网红（扣积分）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()

  // 检查是否第一个网红（免费）
  const { count } = await supabase
    .from('influencers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const isFirst = (count ?? 0) === 0
  const cost = isFirst ? 0 : CREDIT_COSTS.create_influencer

  if (!isFirst) {
    const service = await createServiceClient()
    const creditError = await deductCredits(service, user.id, cost, 'create_influencer')
    if (creditError) return creditError
  }

  const { data, error } = await supabase
    .from('influencers')
    .insert({
      user_id: user.id,
      is_builtin: false,
      slug: body.slug || `user-${user.id.slice(0, 8)}-${Date.now()}`,
      name: body.name,
      type: body.type,
      tagline: body.tagline,
      personality: body.personality,
      domains: body.domains,
      speaking_style: body.speaking_style,
      catchphrases: body.catchphrases,
      chat_style: body.chat_style,
      forbidden: body.forbidden,
      voice_prompt: body.voice_prompt,
      frontal_image_url: body.frontal_image_url,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // 异步注册 Kling 3.0 Subject Library — 不阻塞响应
  if (data?.frontal_image_url && !data?.kling_element_id) {
    const service2 = await createServiceClient()
    ;(async () => {
      try {
        const key = data.frontal_image_url.split('/dreamlab-assets/')[1]
        const imageUrl = key ? await getPresignedUrl(key) : data.frontal_image_url
        const result = await createSubject({ name: data.name, imageUrls: [imageUrl] })
        if (result?.element_id) {
          await service2.from('influencers').update({
            kling_element_id: result.element_id,
            ...(result.voice_id && { kling_element_voice_id: result.voice_id }),
          }).eq('id', data.id)
          logger.info('subject registered', { id: data.id, element_id: result.element_id })
        }
      } catch (err) {
        logger.warn('subject registration failed (non-fatal)', { id: data.id, err: String(err) })
      }
    })()
  }

  return NextResponse.json(data, { status: 201 })
}
