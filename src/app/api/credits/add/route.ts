import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/credits/add — 手动充值（仅开发/测试用）
// 生产环境请在 middleware 或此处加鉴权保护
export async function POST(req: NextRequest) {
  // 只在开发环境或有 admin token 时允许
  if (process.env.NODE_ENV === 'production') {
    const adminToken = req.headers.get('x-admin-token')
    if (adminToken !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount = 100, reason = 'manual_topup' } = await req.json().catch(() => ({}))

  const service = await createServiceClient()
  const { error } = await service.rpc('add_credits', {
    p_user_id: user.id,
    p_amount: Number(amount),
    p_reason: reason,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await service
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ ok: true, newBalance: profile?.credits })
}
