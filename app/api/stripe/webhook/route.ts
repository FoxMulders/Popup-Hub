import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { getStripeClient, getStripeWebhookSecret, isStripeConfigured } from '@/lib/stripe/client'
import { refreshStripeConnectStatus } from '@/lib/stripe/connect'
import { finalizeCoordinatorPlatformInvoicePayment } from '@/lib/cron/coordinator-platform-invoice'
import type Stripe from 'stripe'

async function finalizeStripeBoothPayment(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  paymentIntent: Stripe.PaymentIntent
) {
  const applicationId = paymentIntent.metadata?.application_id
  if (!applicationId) return

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      category_id,
      payment_status,
      payment_method,
      table_count,
      event:events(
        coordinator_id,
        listing_type,
        booth_price_cents,
        multi_table_discount_percent,
        platform_fee_mode,
        platform_fee_flat_cents,
        platform_fee_bps
      )
    `)
    .eq('id', applicationId)
    .maybeSingle()

  if (!application || application.payment_status === 'paid') return

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event
  if (!eventRow) return

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const amountCents = computeApplicationBoothPriceCents(
    limit?.price_per_booth,
    {
      listing_type: eventRow.listing_type,
      booth_price_cents: eventRow.booth_price_cents,
      multi_table_discount_percent: eventRow.multi_table_discount_percent,
    },
    application.table_count ?? 1
  )

  const feeConfig = resolveEventFeeConfig(eventRow)
  const platformFeeCents = computePlatformFeeCents(amountCents, feeConfig)

  await recordPlatformTransaction(supabase, {
    boothApplicationId: application.id,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    coordinatorId: eventRow.coordinator_id,
    categoryId: application.category_id,
    totalAmountCents: amountCents,
    platformFeeCents,
    feeModeUsed: feeConfig.mode,
    processorChargeId: paymentIntent.id,
    processorTransferId:
      typeof paymentIntent.transfer_data?.destination === 'string'
        ? paymentIntent.transfer_data.destination
        : null,
    status: 'completed',
    processor: 'stripe',
  })
}

async function creditCoordinatorWalletTopUp(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  paymentIntent: Stripe.PaymentIntent
) {
  const coordinatorId = paymentIntent.metadata?.coordinator_id
  const amountCents = Number(paymentIntent.metadata?.amount_cents ?? paymentIntent.amount ?? 0)
  if (!coordinatorId || amountCents < 1) return

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', coordinatorId)
    .single()

  if (!wallet) return

  const chargeId = paymentIntent.id
  const { data: existingTx } = await supabase
    .from('wallet_transactions')
    .select('id')
    .contains('metadata', { stripe_payment_intent_id: chargeId })
    .maybeSingle()

  if (existingTx) return

  const newBalance = wallet.balance + amountCents
  await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)
  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'deposit',
    amount: amountCents,
    metadata: {
      kind: 'platform_wallet_topup',
      stripe_payment_intent_id: chargeId,
    },
  })

  await supabase
    .from('profiles')
    .update({ platform_wallet_blocked: false, platform_wallet_grace_until: null })
    .eq('id', coordinatorId)
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const webhookSecret = getStripeWebhookSecret()
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripeClient()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      if (paymentIntent.metadata?.kind === 'coordinator_wallet_topup') {
        await creditCoordinatorWalletTopUp(supabase, paymentIntent)
      } else if (paymentIntent.metadata?.kind === 'coordinator_platform_invoice') {
        const coordinatorId = paymentIntent.metadata?.coordinator_id
        if (coordinatorId) {
          await finalizeCoordinatorPlatformInvoicePayment(supabase, {
            coordinatorId,
            paymentIntentId: paymentIntent.id,
          })
        }
      } else if (paymentIntent.metadata?.application_id) {
        await finalizeStripeBoothPayment(supabase, paymentIntent)
      }
      break
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const coordinatorId = account.metadata?.coordinator_id
      if (coordinatorId) {
        await refreshStripeConnectStatus(supabase, coordinatorId)
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
