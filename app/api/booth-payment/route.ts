import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { reclaimStalePaymentProcessing } from '@/lib/applications/booth-payment-processing'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import {
  createBoothPayment,
  getBoothPayment,
} from '@/lib/square/payments'
import { getCoordinatorAccessToken } from '@/lib/square/oauth'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'

const COMPLETED_PAYMENT_STATUSES = new Set(['COMPLETED', 'APPROVED'])

async function finalizePaidApplication(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  params: {
    applicationId: string
    paymentId: string
    eventId: string
    vendorId: string
    coordinatorId: string
    categoryId: string
    amountCents: number
    platformFeeCents: number
    feeMode: ReturnType<typeof resolveEventFeeConfig>['mode']
  }
) {
  await recordPlatformTransaction(supabase, {
    boothApplicationId: params.applicationId,
    eventId: params.eventId,
    vendorId: params.vendorId,
    coordinatorId: params.coordinatorId,
    categoryId: params.categoryId,
    totalAmountCents: params.amountCents,
    platformFeeCents: params.platformFeeCents,
    feeModeUsed: params.feeMode,
    processorChargeId: params.paymentId,
    status: 'completed',
  })

  return {
    paymentId: params.paymentId,
    boothPriceCents: params.amountCents,
    platformFeeCents: params.platformFeeCents,
    coordinatorPayoutCents: params.amountCents - params.platformFeeCents,
  }
}

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
      square_payment_id,
      payment_processing_at,
      table_count,
      event:events(
        coordinator_id,
        square_merchant_id,
        listing_type,
        booth_price_cents,
        multi_table_discount_percent,
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

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .single()

  const amountCents = computeApplicationBoothPriceCents(
    limit?.price_per_booth as number | undefined,
    {
      listing_type: eventRow?.listing_type,
      booth_price_cents: eventRow?.booth_price_cents as number | undefined,
      multi_table_discount_percent: eventRow?.multi_table_discount_percent as
        | number
        | undefined,
    },
    (application.table_count as number) ?? 1
  )
  if (amountCents <= 0) {
    await supabase
      .from('booth_applications')
      .update({ payment_status: 'paid', payment_processing_at: null })
      .eq('id', applicationId)
      .eq('payment_status', 'payment_required')
    return NextResponse.json({ paymentId: null, free: true })
  }

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

  let paymentStatus = application.payment_status as string

  if (paymentStatus === 'processing') {
    const knownPaymentId = application.square_payment_id as string | null
    if (!knownPaymentId) {
      const reclaimed = await reclaimStalePaymentProcessing(supabase, applicationId)
      if (reclaimed) {
        paymentStatus = 'payment_required'
      } else {
        return NextResponse.json(
          { error: 'Payment is already in progress. Please wait a moment and refresh.' },
          { status: 409 }
        )
      }
    } else {
      const squarePayment = await getBoothPayment(credentials.accessToken, knownPaymentId)

      if (
        squarePayment?.id &&
        COMPLETED_PAYMENT_STATUSES.has(squarePayment.status ?? '')
      ) {
        const result = await finalizePaidApplication(supabase, {
          applicationId,
          paymentId: squarePayment.id,
          eventId: application.event_id,
          vendorId: application.vendor_id,
          coordinatorId,
          categoryId: application.category_id,
          amountCents,
          platformFeeCents,
          feeMode: feeConfig.mode,
        })
        return NextResponse.json(result)
      }

      return NextResponse.json(
        { error: 'Payment is already in progress. Please wait a moment and refresh.' },
        { status: 409 }
      )
    }
  }

  if (paymentStatus !== 'payment_required') {
    return NextResponse.json({ error: 'Payment not available for this application' }, { status: 400 })
  }

  const { data: claimed } = await supabase
    .from('booth_applications')
    .update({
      payment_status: 'processing',
      payment_processing_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('payment_status', 'payment_required')
    .select('id')
    .maybeSingle()

  if (!claimed) {
    const { data: current } = await supabase
      .from('booth_applications')
      .select('payment_status')
      .eq('id', applicationId)
      .single()

    if (current?.payment_status === 'paid') {
      return NextResponse.json({ error: 'This booth is already paid' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Payment is already in progress. Please wait a moment and refresh.' },
      { status: 409 }
    )
  }

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
      .update({
        payment_status: 'payment_required',
        payment_processing_at: null,
      })
      .eq('id', applicationId)
      .eq('payment_status', 'processing')
    return NextResponse.json({ error: error ?? 'Payment failed' }, { status: 402 })
  }

  await supabase
    .from('booth_applications')
    .update({ square_payment_id: paymentId })
    .eq('id', applicationId)
    .eq('payment_status', 'processing')

  const result = await finalizePaidApplication(supabase, {
    applicationId,
    paymentId,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    coordinatorId,
    categoryId: application.category_id,
    amountCents,
    platformFeeCents,
    feeMode: feeConfig.mode,
  })

  return NextResponse.json(result)
}
