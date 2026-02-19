import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES, type CreditPackageId } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { packageId } = await req.json()
  const pkg = CREDIT_PACKAGES[packageId as CreditPackageId]
  if (!pkg) return apiError('Invalid package', 400)

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
        unit_amount: pkg.price,
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
