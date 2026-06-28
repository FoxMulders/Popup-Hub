import type { SupabaseClient } from '@supabase/supabase-js'
import { coordinatorPublishBlockReason, COORDINATOR_FRAUD_PROFILE_SELECT } from '@/lib/coordinator/verification'
import { publishCoordinatorEvent } from '@/lib/coordinator/publish-event'

export type PublishAssistRequestRow = {
  id: string
  event_id: string
  coordinator_id: string
  status: string
  request_note: string | null
  block_reason: string | null
  review_note: string | null
  created_at: string
}

export async function getPendingPublishAssistForEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<PublishAssistRequestRow | null> {
  const { data } = await supabase
    .from('event_publish_assist_requests')
    .select('id, event_id, coordinator_id, status, request_note, block_reason, review_note, created_at')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .maybeSingle()

  return (data as PublishAssistRequestRow | null) ?? null
}

export async function createPublishAssistRequest(
  supabase: SupabaseClient,
  args: {
    eventId: string
    coordinatorId: string
    requestNote?: string | null
  }
): Promise<{ ok: true; request: PublishAssistRequestRow } | { ok: false; error: string; status: number }> {
  const existing = await getPendingPublishAssistForEvent(supabase, args.eventId)
  if (existing) {
    return { ok: true, request: existing }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, status, coordinator_id')
    .eq('id', args.eventId)
    .maybeSingle()

  if (!event || event.coordinator_id !== args.coordinatorId) {
    return { ok: false, error: 'Event not found', status: 404 }
  }

  if (event.status !== 'draft') {
    return { ok: false, error: 'Only draft markets can request publish assistance.', status: 409 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(COORDINATOR_FRAUD_PROFILE_SELECT)
    .eq('id', args.coordinatorId)
    .single()

  const { data: squareEvent } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', args.coordinatorId)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const blockReason = coordinatorPublishBlockReason({
    ...profile,
    has_square_event: !!squareEvent,
  })

  const { data: inserted, error } = await supabase
    .from('event_publish_assist_requests')
    .insert({
      event_id: args.eventId,
      coordinator_id: args.coordinatorId,
      request_note: args.requestNote?.trim() || null,
      block_reason: blockReason,
      status: 'pending',
    })
    .select('id, event_id, coordinator_id, status, request_note, block_reason, review_note, created_at')
    .single()

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? 'Could not create request', status: 500 }
  }

  return { ok: true, request: inserted as PublishAssistRequestRow }
}

export async function approvePublishAssistRequest(
  admin: SupabaseClient,
  requestId: string,
  reviewerId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: request, error } = await admin
    .from('event_publish_assist_requests')
    .select('id, event_id, coordinator_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (error || !request) {
    return { ok: false, error: 'Request not found', status: 404 }
  }

  if (request.status !== 'pending') {
    return { ok: false, error: 'Request is no longer pending', status: 409 }
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      'id, status, coordinator_id, latitude, longitude, address, venue_verified, venue_verification_status'
    )
    .eq('id', request.event_id)
    .single()

  if (eventError || !event) {
    return { ok: false, error: 'Event not found', status: 404 }
  }

  if (event.coordinator_id !== request.coordinator_id) {
    return { ok: false, error: 'Event ownership mismatch', status: 409 }
  }

  const publishResult = await publishCoordinatorEvent(admin, admin, event, {
    bypassTrustGate: true,
    assistRequestId: requestId,
    reviewerId,
  })
  if (!publishResult.ok) {
    return { ok: false, error: publishResult.error, status: publishResult.status }
  }

  return { ok: true }
}

export async function rejectPublishAssistRequest(
  admin: SupabaseClient,
  requestId: string,
  reviewerId: string,
  reviewNote?: string | null
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: request } = await admin
    .from('event_publish_assist_requests')
    .select('id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) {
    return { ok: false, error: 'Request not found', status: 404 }
  }

  if (request.status !== 'pending') {
    return { ok: false, error: 'Request is no longer pending', status: 409 }
  }

  const { error: updateError } = await admin
    .from('event_publish_assist_requests')
    .update({
      status: 'rejected',
      review_note: reviewNote?.trim() || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 }
  }

  return { ok: true }
}
