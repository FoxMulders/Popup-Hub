import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { getCoordinatorScope, applyCoordinatorEventScope } from '@/lib/events/coordinator-event-query'
import {
  canMutateCoordinatorEvent,
  COORDINATOR_EVENT_NOT_OWNER_MESSAGE,
} from '@/lib/events/coordinator-event-ownership'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'
import { publishCoordinatorEvent } from '@/lib/coordinator/publish-event'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  if (
    !canMutateCoordinatorEvent({
      userId: user.id,
      isAdmin: scope.isAdmin,
      eventCoordinatorId: event.coordinator_id,
    })
  ) {
    return NextResponse.json({ error: COORDINATOR_EVENT_NOT_OWNER_MESSAGE }, { status: 403 })
  }

  if (event.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft markets can be published from pre-flight review.' },
      { status: 409 }
    )
  }

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select(COORDINATOR_FRAUD_PROFILE_SELECT)
    .eq('id', event.coordinator_id)
    .single()

  const { data: squareEvent } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', event.coordinator_id)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const publishBlock = coordinatorPublishBlockReason({
    ...ownerProfile,
    has_square_event: !!squareEvent,
  })
  if (publishBlock) {
    return NextResponse.json({ error: publishBlock }, { status: 403 })
  }

  const service = await createServiceClient()
  const publishResult = await publishCoordinatorEvent(supabase, service, event)
  if (!publishResult.ok) {
    return NextResponse.json({ error: publishResult.error }, { status: publishResult.status })
  }

  return NextResponse.json({ ok: true, status: 'published' })
}
