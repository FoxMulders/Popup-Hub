import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import { createBoothPayment } from '@/lib/square/payments'
import { getCoordinatorAccessToken } from '@/lib/square/oauth'

export async function POST(request: Request) {
  const supabase = await createServiceClient()

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

  const body = await request.json()
  const { sourceId, applicationId } = body

  if (!sourceId || !applicationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
      application_payment_status,
      event:events(
        coordinator_id,
        square_merchant_id,
        platform_fee_mode,
        platform_fee_flat_cents,
        platform_fee_bps
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
    return NextResponse.json(
      { error: 'Payment is only available after approval' },
      { status: 400 }
    )
  }

  if (application.payment_method === 'ETRANSFER') {
    return NextResponse.json(
      { error: 'This application uses e-transfer. The coordinator will confirm payment manually.' },
      { status: 400 }
    )
  }

  if (application.payment_status === 'paid') {
    return NextResponse.json({ error: 'This booth is already paid' }, { status: 400 })
  }

  if (
    application.payment_status !== 'payment_required' &&
    application.payment_status !== 'processing'
  ) {
    return NextResponse.json({ error: 'Payment not available for this application' }, { status: 400 })
  }

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .single()

  const amountCents = (limit?.price_per_booth as number) ?? 0
  if (amountCents <= 0) {
    await supabase
      .from('booth_applications')
      .update({ payment_status: 'paid' })
      .eq('id', applicationId)
    return NextResponse.json({ paymentId: null, free: true })
  }

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event

  const feeConfig = resolveEventFeeConfig(eventRow)
  const platformFeeCents = computePlatformFeeCents(amountCents, feeConfig)
  const coordinatorId = eventRow?.coordinator_id as string

  const credentials = await getCoordinatorAccessToken(supabase, coordinatorId)
  if (!credentials?.accessToken) {
    return NextResponse.json(
      { error: 'Coordinator has not connected Square for payouts' },
      { status: 422 }
    )
  }

  await supabase
    .from('booth_applications')
    .update({ payment_status: 'processing' })
    .eq('id', applicationId)

  const { paymentId, error } = await createBoothPayment({
    sourceId,
    amountCents,
    eventId: application.event_id,
    applicationId,
    coordinatorAccessToken: credentials.accessToken,
    platformFeeCents,
  })

  if (error || !paymentId) {
    await supabase
      .from('booth_applications')
      .update({ payment_status: 'payment_required' })
      .eq('id', applicationId)
    return NextResponse.json({ error: error ?? 'Payment failed' }, { status: 402 })
  }

  await supabase
    .from('booth_applications')
    .update({
      square_payment_id: paymentId,
      payment_status: 'paid',
    })
    .eq('id', applicationId)

  await recordPlatformTransaction(supabase, {
    boothApplicationId: applicationId,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    coordinatorId,
    categoryId: application.category_id,
    totalAmountCents: amountCents,
    platformFeeCents,
    feeModeUsed: feeConfig.mode,
    processorChargeId: paymentId,
    status: 'completed',
  })

  return NextResponse.json({
    paymentId,
    boothPriceCents: amountCents,
    platformFeeCents,
    coordinatorPayoutCents: amountCents - platformFeeCents,
  })
}
