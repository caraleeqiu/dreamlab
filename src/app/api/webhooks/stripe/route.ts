import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const logger = createLogger('webhook:stripe')

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-01-28.clover' })
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Webhook Error'
    logger.warn('signature verification failed', { message })
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { user_id, package_id, credits } = session.metadata ?? {}

    if (!user_id || !credits) {
      logger.error('missing metadata', { sessionId: session.id })
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const creditsAmount = parseInt(credits, 10)

    // Service-role client to bypass RLS
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check for duplicate (idempotency)
    const { data: existing } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (existing) {
      logger.info('duplicate session, skipping', { sessionId: session.id })
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Add credits atomically
    const { error } = await supabase.rpc('add_credits', {
      p_user_id: user_id,
      p_amount: creditsAmount,
      p_reason: `充值: 套餐${package_id}`,
      p_stripe_session_id: session.id,
    })

    if (error) {
      logger.error('add_credits failed', { sessionId: session.id, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info('credits added', { userId: user_id, credits: creditsAmount, packageId: package_id })
  }

  return NextResponse.json({ received: true })
}
