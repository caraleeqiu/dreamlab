import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CREDIT_COSTS } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'

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
  return NextResponse.json(data, { status: 201 })
}
