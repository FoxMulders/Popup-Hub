import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { getCoordinatorScope, applyCoordinatorEventScope } from '@/lib/events/coordinator-event-query'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'
import { assertEventVenueVerifiedForPublish } from '@/lib/venues/persist-event-venue-verification'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyVendorsOfNearbyPublishedMarket } from '@/lib/vendor/nearby-market-alerts'

type PatchBody = {
  status?: 'published'
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`role, is_admin, ${COORDINATOR_FRAUD_PROFILE_SELECT}`)
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.status !== 'published') {
    return NextResponse.json(
      { error: 'Only publishing draft markets is supported on this endpoint.' },
      { status: 400 }
    )
  }

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event, error: eventError } = await applyCoordinatorEventScope(
    supabase
      .from('events')
      .select(
        'id, status, coordinator_id, latitude, longitude, address, venue_verified, venue_verification_status'
      )
      .eq('id', eventId),
    user.id,
    scope.isAdmin
  ).single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft markets can be published from pre-flight review.' },
      { status: 409 }
    )
  }

  const { data: squareEvent } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', event.coordinator_id)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const publishBlock = coordinatorPublishBlockReason({
    ...profile,
    has_square_event: !!squareEvent,
  })
  if (publishBlock) {
    return NextResponse.json({ error: publishBlock }, { status: 403 })
  }

  if (
    !event.venue_verified &&
    event.venue_verification_status !== 'manual_override'
  ) {
    const venueGate = await assertEventVenueVerifiedForPublish(supabase, eventId, {
      latitude: event.latitude,
      longitude: event.longitude,
      address: event.address,
      pinDropped: true,
    })
    if (!venueGate.ok) {
      return NextResponse.json({ error: venueGate.reason }, { status: 400 })
    }
  }

  const { data: limits, error: limitsError } = await supabase
    .from('event_category_limits')
    .select('price_per_booth, category:categories(name)')
    .eq('event_id', eventId)

  if (limitsError) {
    return NextResponse.json({ error: 'Could not verify booth fees before publishing.' }, { status: 500 })
  }

  type FeeRow = {
    price_per_booth: number | null
    category: { name?: string | null } | { name?: string | null }[] | null
  }

  const rows = (limits ?? []) as FeeRow[]
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one booth category and state its fee before publishing.' },
      { status: 400 }
    )
  }

  const missing = rows.find(
    (row) =>
      row.price_per_booth === null ||
      row.price_per_booth === undefined ||
      !Number.isFinite(row.price_per_booth) ||
      row.price_per_booth < 0
  )
  if (missing) {
    const cat = Array.isArray(missing.category) ? missing.category[0] : missing.category
    const catName = cat?.name ?? 'one of your categories'
    return NextResponse.json(
      { error: `Set a booth fee for ${catName} before publishing. Use $0 for free booths.` },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase
    .from('events')
    .update({ status: 'published' })
    .eq('id', eventId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const service = await createServiceClient()
  const { data: publishedEvent } = await service
    .from('events')
    .select('id, name, start_at, latitude, longitude, city')
    .eq('id', eventId)
    .single()

  if (publishedEvent) {
    void notifyVendorsOfNearbyPublishedMarket(service, publishedEvent).catch((err) => {
      console.error('[publish] nearby vendor alerts failed', err)
    })
  }

  return NextResponse.json({ ok: true, status: 'published' })
}
