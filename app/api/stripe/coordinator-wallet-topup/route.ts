import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

const TOP_UP_AMOUNTS = [2500, 5000, 10000, 25000]

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin, email')
    .eq('id', user.id)
    .single()

  if (!profile || !canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const body = (await request.json()) as { amountCents?: number }
  const amountCents = Math.round(body.amountCents ?? 5000)
  if (!TOP_UP_AMOUNTS.includes(amountCents) && (amountCents < 500 || amountCents > 500000)) {
    return NextResponse.json({ error: 'Invalid top-up amount' }, { status: 400 })
  }

  const stripe = getStripeClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: profile.email,
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: amountCents,
          product_data: {
            name: 'Popup Hub platform wallet top-up',
            description: 'Credits your coordinator wallet for offline payment platform fees.',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/coordinator/payment-methods?wallet_topup=success`,
    cancel_url: `${baseUrl}/coordinator/payment-methods?wallet_topup=cancelled`,
    payment_intent_data: {
      metadata: {
        kind: 'coordinator_wallet_topup',
        coordinator_id: user.id,
        amount_cents: String(amountCents),
      },
    },
  })

  await createServiceClient()

  return NextResponse.json({ url: session.url })
}
