import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/influencers — 拉取内置网红 + 当前用户自建网红
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .or(`is_builtin.eq.true,user_id.eq.${user.id}`)
    .order('is_builtin', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/influencers — 创建用户自建网红（扣积分）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // 检查是否第一个网红（免费）
  const { count } = await supabase
    .from('influencers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const isFirst = (count ?? 0) === 0
  const cost = isFirst ? 0 : 10

  if (!isFirst) {
    // 扣积分
    const service = await createServiceClient()
    const { error: deductError } = await service.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_reason: 'create_influencer',
    })
    if (deductError) {
      if (deductError.message.includes('insufficient_credits')) {
        return NextResponse.json({ error: '积分不足，请充值后再创建' }, { status: 402 })
      }
      return NextResponse.json({ error: deductError.message }, { status: 500 })
    }
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
