import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getAuctionParticipation,
  registerAuctionParticipation,
} from '@/lib/quarter-auction/participation'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const participant = await getAuctionParticipation(supabase, eventId, user.id)
  return NextResponse.json({
    participated: !!participant,
    participated_at: participant?.participated_at ?? null,
  })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params
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
      { error: 'Location is required to verify you are at the event.' },
      { status: 400 }
    )
  }

  const service = await createServiceClient()
  const { data: event } = await service
    .from('events')
    .select('id, latitude, longitude, status')
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!['published', 'active', 'completed'].includes(event.status)) {
    return NextResponse.json({ error: 'Event is not open for auction participation' }, { status: 422 })
  }

  const result = await registerAuctionParticipation(service, {
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

  return NextResponse.json({
    participated: true,
    participated_at: result.participant.participated_at,
    alreadyRegistered: result.alreadyRegistered,
  })
}
