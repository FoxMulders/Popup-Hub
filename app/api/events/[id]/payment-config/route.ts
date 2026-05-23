import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { getCoordinatorAccessToken } from '@/lib/square/oauth'

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
      platform_fee_mode,
      platform_fee_flat_cents,
      platform_fee_bps
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

  const locationId =
    credentials?.locationId ??
    process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ??
    null

  const feeConfig = resolveEventFeeConfig(event)

  return NextResponse.json({
    eventId: event.id,
    squareAppId: process.env.NEXT_PUBLIC_SQUARE_APP_ID,
    squareLocationId: locationId,
    squareConnected,
    feeConfig,
  })
}
