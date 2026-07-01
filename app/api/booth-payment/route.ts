import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { reclaimStalePaymentProcessing } from '@/lib/applications/booth-payment-processing'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import type { BoothCheckoutBreakdown } from '@/lib/monetization/booth-checkout'
import { resolveBoothCheckoutFromApplication } from '@/lib/monetization/resolve-booth-checkout'
import {
  createBoothPayment,
  getBoothPayment,
} from '@/lib/square/payments'
import { getCoordinatorAccessToken } from '@/lib/square/oauth'
import { assertVendorCanPayForApplication } from '@/lib/engagement/booth-access'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPaymentCollectionBlockReason,
} from '@/lib/coordinator/verification'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'
import { PAYMENT_CHASE_CLEARED_FIELDS } from '@/lib/applications/payment-deadline'
import { enforceNativeMarketPermissions } from '@/lib/markets/enforce-native-market-permissions'

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
    checkout: BoothCheckoutBreakdown
    feeMode: ReturnType<typeof resolveEventFeeConfig>['mode']
    eventEndAt?: string | null
  }
) {
  await recordPlatformTransaction(supabase, {
    boothApplicationId: params.applicationId,
    eventId: params.eventId,
    vendorId: params.vendorId,
    coordinatorId: params.coordinatorId,
    categoryId: params.categoryId,
    totalAmountCents: params.checkout.totalChargedCents,
    platformFeeCents: params.checkout.platformFeeCents,
    baseBoothCents: params.checkout.baseBoothCents,
    feeModeUsed: params.feeMode,
    processorChargeId: params.paymentId,
    status: 'completed',
    externalProcessorPayout: true,
    eventEndAt: params.eventEndAt ?? null,
  })

  return {
    paymentId: params.paymentId,
    boothPriceCents: params.checkout.baseBoothCents,
    totalChargedCents: params.checkout.totalChargedCents,
    platformFeeCents: params.checkout.platformFeeCents,
    coordinatorPayoutCents: params.checkout.organizerPayoutCents,
    passFeesToVendor: params.checkout.passFeesToVendor,
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
        platform_fee_bps,
        venue_verified,
        venue_verification_status,
        venue_verification_reason,
        vendor_access_equality_until,
        pass_fees_to_vendor,
        end_at
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const nativeGate = await enforceNativeMarketPermissions(supabase, application.event_id)
  if (nativeGate) return nativeGate

  if (application.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.status !== 'approved') {
    return NextResponse.json(
      { error: 'Payment is only available after approval' },
      { status: 400 }
    )
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

  if (application.payment_method === 'ETRANSFER' || application.payment_method === 'CASH') {
    return NextResponse.json(
      { error: 'This application uses offline payment. The coordinator will confirm payment manually.' },
      { status: 400 }
    )
  }

  if (application.payment_method === 'STRIPE') {
    return NextResponse.json(
      { error: 'This application uses Stripe checkout. Complete payment via the Stripe flow.' },
      { status: 400 }
    )
  }

  if (application.payment_status === 'paid') {
    return NextResponse.json({ error: 'This booth is already paid' }, { status: 400 })
  }

  const coordinatorId = eventRow?.coordinator_id as string

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .single()

  const checkout = await resolveBoothCheckoutFromApplication(supabase, {
    pricePerBooth: limit?.price_per_booth as number | undefined,
    tableCount: (application.table_count as number) ?? 1,
    eventRow,
    coordinatorId,
  })

  if (checkout.baseBoothCents <= 0) {
    await supabase
      .from('booth_applications')
      .update({ payment_status: 'paid', payment_processing_at: null, ...PAYMENT_CHASE_CLEARED_FIELDS })
      .eq('id', applicationId)
      .eq('payment_status', 'payment_required')
    return NextResponse.json({ paymentId: null, free: true })
  }

  const feeConfig = resolveEventFeeConfig(eventRow)

  const { data: coordinatorProfile } = await supabase
    .from('profiles')
    .select(COORDINATOR_FRAUD_PROFILE_SELECT)
    .eq('id', coordinatorId)
    .single()

  const paymentBlock = coordinatorPaymentCollectionBlockReason({
    ...coordinatorProfile,
    has_square_event: !!eventRow?.square_merchant_id,
  })
  if (paymentBlock) {
    return NextResponse.json({ error: paymentBlock }, { status: 403 })
  }

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
          checkout,
          feeMode: feeConfig.mode,
          eventEndAt: eventRow?.end_at as string | undefined,
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
    amountCents: checkout.totalChargedCents,
    appFeeCents: checkout.squareAppFeeCents,
    eventId: application.event_id,
    applicationId,
    coordinatorAccessToken: credentials.accessToken,
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
    checkout,
    feeMode: feeConfig.mode,
    eventEndAt: eventRow?.end_at as string | undefined,
  })

  return NextResponse.json(result)
}
