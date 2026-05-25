import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getMarketPatronCheckIn,
  registerMarketPatronCheckIn,
  resolvePassportVendorsRequired,
} from '@/lib/market-passport/check-in'
import { getPassportProgress } from '@/lib/market-passport/passport'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const { data: event } = await service
    .from('events')
    .select('id, status, passport_vendors_required')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const checkIn = await getMarketPatronCheckIn(supabase, eventId, user.id)
  const vendorsRequired = resolvePassportVendorsRequired(event.passport_vendors_required)
  const progress = checkIn
    ? await getPassportProgress(supabase, eventId, user.id, event.passport_vendors_required)
    : {
        scannedCount: 0,
        vendorsRequired,
        bonusEligible: false,
        scannedVendorIds: [] as string[],
      }

  return NextResponse.json({
    checkedIn: !!checkIn,
    paddleNumber: checkIn?.paddle_number ?? null,
    checkedInAt: checkIn?.checked_in_at ?? null,
    progress,
  })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { lat?: number; lng?: number }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json(
      { error: 'Location is required to verify you are at the market.' },
      { status: 400 }
    )
  }

  const service = await createServiceClient()
  const { data: event } = await service
    .from('events')
    .select('id, latitude, longitude, status, passport_vendors_required')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (!['published', 'active'].includes(event.status)) {
    return NextResponse.json({ error: 'Market is not open for check-in' }, { status: 422 })
  }

  const result = await registerMarketPatronCheckIn(service, {
    eventId,
    userId: user.id,
    lat: body.lat,
    lng: body.lng,
    eventLat: event.latitude,
    eventLng: event.longitude,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, distanceMeters: result.distanceMeters },
      { status: result.status }
    )
  }

  const progress = await getPassportProgress(
    service,
    eventId,
    user.id,
    event.passport_vendors_required
  )

  return NextResponse.json({
    checkedIn: true,
    paddleNumber: result.checkIn.paddle_number,
    checkedInAt: result.checkIn.checked_in_at,
    alreadyCheckedIn: result.alreadyCheckedIn,
    progress,
  })
}
