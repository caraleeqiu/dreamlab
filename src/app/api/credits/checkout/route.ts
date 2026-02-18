import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const PACKAGES: Record<string, { credits: number; bonus: number; price: number; name: string }> = {
  starter:  { credits: 100,  bonus: 0,   price: 990,   name: '入门包 100积分' },
  standard: { credits: 300,  bonus: 30,  price: 2500,  name: '标准包 300+30积分' },
  pro:      { credits: 800,  bonus: 100, price: 5900,  name: '专业包 800+100积分' },
  team:     { credits: 2000, bonus: 300, price: 12800, name: '团队包 2000+300积分' },
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json()
  const pkg = PACKAGES[packageId]
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-01-28.clover' })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'cny',
        product_data: {
          name: `Dreamlab ${pkg.name}`,
          description: `${pkg.credits + pkg.bonus} 积分充值`,
        },
        unit_amount: pkg.price, // 单位：分
      },
      quantity: 1,
    }],
    metadata: {
      user_id: user.id,
      package_id: packageId,
      credits: String(pkg.credits + pkg.bonus),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits?cancelled=1`,
  })

  return NextResponse.json({ url: session.url })
}
