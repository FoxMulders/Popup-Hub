import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  resolveEnabledPaymentMethods,
  resolveVendorCheckoutMethods,
} from '@/lib/applications/payment-fields'
import { readCoordinatorPaymentInstructions } from '@/lib/payments/event-payment-flags'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { loadCoordinatorEscrowContext } from '@/lib/coordinator/escrow'
import {
  fetchPrimaryLocationId,
  getCoordinatorAccessToken,
} from '@/lib/square/oauth'
import { resolveSquareApplicationId } from '@/lib/square/app-credentials'
import { resolveCoordinatorEtransferEmail } from '@/lib/coordinator/etransfer-email'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  const { data: event } = await supabase
    .from('events')
    .select(`
      id,
      coordinator_id,
      square_merchant_id,
      status,
      accepts_credit_card,
      accepts_etransfer,
      accepts_cash,
      accepts_square,
      accepts_stripe,
      accepts_offline_etransfer,
      accepts_offline_cash,
      platform_fee_mode,
      platform_fee_flat_cents,
      platform_fee_bps,
      pass_fees_to_vendor,
      coordinator:profiles!events_coordinator_id_fkey(
        email,
        etransfer_payment_email,
        offline_payment_instructions,
        payment_instructions,
        stripe_connected_id,
        stripe_onboarding_complete
      )
    `)
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!['published', 'active', 'completed'].includes(event.status as string)) {
    return NextResponse.json({ error: 'Event not available' }, { status: 404 })
  }

  const credentials = await getCoordinatorAccessToken(serviceSupabase, event.coordinator_id)
  const squareConnected =
    !!event.square_merchant_id || !!credentials?.accessToken

  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const stripeConnected =
    !!coordinator?.stripe_connected_id && coordinator?.stripe_onboarding_complete === true

  let locationId =
    credentials?.locationId ??
    process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ??
    null

  if (!locationId && credentials?.accessToken) {
    locationId = await fetchPrimaryLocationId(credentials.accessToken)
    if (locationId) {
      await serviceSupabase
        .from('profiles')
        .update({ square_location_id: locationId })
        .eq('id', event.coordinator_id)
    }
  }

  const feeConfig = resolveEventFeeConfig(event)
  const coordinatorEtransferEmail = resolveCoordinatorEtransferEmail(coordinator)
  const connection = { squareConnected, stripeConnected }
  const { escrowExempt: coordinatorEscrowExempt } = await loadCoordinatorEscrowContext(
    serviceSupabase,
    event.coordinator_id
  )
  const enabledPaymentMethods = resolveEnabledPaymentMethods(event, connection)
  const vendorCheckoutMethods = resolveVendorCheckoutMethods(event, connection)
  const paymentInstructions = readCoordinatorPaymentInstructions(coordinator ?? {})

  return NextResponse.json({
    eventId: event.id,
    squareAppId: resolveSquareApplicationId(),
    squareLocationId: locationId,
    squareConnected,
    stripeConnected,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    enabledPaymentMethods,
    vendorCheckoutMethods,
    feeConfig,
    passFeesToVendor: event.pass_fees_to_vendor === true,
    coordinatorEscrowExempt,
    coordinatorEtransferEmail,
    paymentInstructions,
    offlinePaymentInstructions: paymentInstructions,
  })
}
