import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { assertVendorCanPayForApplication } from '@/lib/engagement/booth-access'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'vendor') {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const body = (await request.json()) as { applicationId?: string }
  const { applicationId } = body
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      category_id,
      status,
      payment_status,
      payment_method,
      table_count,
      event:events(
        coordinator_id,
        accepts_stripe,
        listing_type,
        booth_price_cents,
        multi_table_discount_percent,
        platform_fee_mode,
        platform_fee_flat_cents,
        platform_fee_bps,
        venue_verified,
        venue_verification_status,
        venue_verification_reason,
        vendor_access_equality_until,
        coordinator:profiles!events_coordinator_id_fkey(stripe_connected_id, stripe_onboarding_complete)
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.status !== 'approved') {
    return NextResponse.json({ error: 'Payment is only available after approval' }, { status: 400 })
  }

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event
  if (eventRow) {
    const venueGate = requireVenueVerified(eventRow)
    if (!venueGate.ok) {
      return NextResponse.json({ error: venueGate.reason }, { status: 403 })
    }
    const payGate = await assertVendorCanPayForApplication(supabase, {
      event: { id: application.event_id, ...eventRow },
      vendorId: user.id,
      categoryId: application.category_id,
    })
    if (!payGate.ok) {
      return NextResponse.json({ error: payGate.reason }, { status: 403 })
    }
  }

  if (application.payment_method !== 'STRIPE') {
    return NextResponse.json({ error: 'This application does not use Stripe checkout' }, { status: 400 })
  }

  if (application.payment_status === 'paid') {
    return NextResponse.json({ error: 'This booth is already paid' }, { status: 400 })
  }

  if (!eventRow?.accepts_stripe) {
    return NextResponse.json({ error: 'Stripe payments are not enabled for this market' }, { status: 422 })
  }

  const coordinator = Array.isArray(eventRow.coordinator)
    ? eventRow.coordinator[0]
    : eventRow.coordinator

  if (!coordinator?.stripe_connected_id || !coordinator?.stripe_onboarding_complete) {
    return NextResponse.json(
      { error: 'Coordinator has not finished Stripe Connect onboarding' },
      { status: 422 }
    )
  }

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .single()

  const amountCents = computeApplicationBoothPriceCents(
    limit?.price_per_booth,
    {
      listing_type: eventRow.listing_type,
      booth_price_cents: eventRow.booth_price_cents,
      multi_table_discount_percent: eventRow.multi_table_discount_percent,
    },
    application.table_count ?? 1
  )

  if (amountCents <= 0) {
    await serviceSupabase
      .from('booth_applications')
      .update({ payment_status: 'paid' })
      .eq('id', applicationId)
    return NextResponse.json({ clientSecret: null, free: true })
  }

  const feeConfig = resolveEventFeeConfig(eventRow)
  const platformFeeCents = computePlatformFeeCents(amountCents, feeConfig)
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'cad',
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: coordinator.stripe_connected_id,
      },
      metadata: {
        application_id: applicationId,
        event_id: application.event_id,
        vendor_id: application.vendor_id,
        coordinator_id: eventRow.coordinator_id,
      },
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey: `booth-${applicationId}-${amountCents}` }
  )

  await serviceSupabase
    .from('booth_applications')
    .update({
      payment_status: 'processing',
      payment_processing_at: new Date().toISOString(),
      stripe_payment_id: paymentIntent.id,
    })
    .eq('id', applicationId)

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    boothPriceCents: amountCents,
    platformFeeCents,
  })
}
