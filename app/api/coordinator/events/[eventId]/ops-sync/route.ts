import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import {
  applyEarlyExitReliability,
  applyLateLoadInReliability,
  createVendorReliabilityAdminClient,
} from '@/lib/coordinator/vendor-reliability-ops'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createClient } from '@/lib/supabase/server'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

export async function POST(
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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const scope = await getCoordinatorScope(supabase, user.id)
  const { data: event, error: eventError } = await applyCoordinatorEventScope(
    supabase.from('events').select('id').eq('id', eventId),
    user.id,
    scope.isAdmin
  ).maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const body = (await request.json()) as { mutations?: PendingCoordinatorMutation[] }
  const mutations = [...(body.mutations ?? [])].sort(
    (a, b) => a.clientTimestamp - b.clientTimestamp
  )

  const appliedIds: string[] = []
  const conflicts: Array<{ id: string; reason: string }> = []
  const reliabilityAdmin = createVendorReliabilityAdminClient()

  for (const mutation of mutations) {
    if (mutation.eventId !== eventId) {
      conflicts.push({ id: mutation.id, reason: 'event_mismatch' })
      continue
    }

    try {
      const applied = await applyMutation(supabase, reliabilityAdmin, eventId, mutation)
      if (applied) appliedIds.push(mutation.id)
      else conflicts.push({ id: mutation.id, reason: 'apply_failed' })
    } catch {
      conflicts.push({ id: mutation.id, reason: 'apply_error' })
    }
  }

  return NextResponse.json({
    applied: appliedIds.length,
    appliedIds,
    conflicts,
  })
}

async function resolveVendorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  applicationId: string,
  payloadVendorId: unknown
): Promise<string | null> {
  if (typeof payloadVendorId === 'string' && payloadVendorId) return payloadVendorId
  const { data: application } = await supabase
    .from('booth_applications')
    .select('vendor_id')
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .maybeSingle()
  return application?.vendor_id ?? null
}

async function applyMutation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reliabilityAdmin: ReturnType<typeof createVendorReliabilityAdminClient>,
  eventId: string,
  mutation: PendingCoordinatorMutation
): Promise<boolean> {
  const { type, payload } = mutation
  const applicationId = String(payload.applicationId ?? '')

  switch (type) {
    case 'check_in': {
      const { error } = await supabase
        .from('booth_applications')
        .update({ checked_in: Boolean(payload.checked_in) })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      return !error
    }
    case 'payment_status': {
      const updates = (payload.updates ?? {}) as Record<string, unknown>
      const { error } = await supabase
        .from('booth_applications')
        .update(updates)
        .eq('id', applicationId)
        .eq('event_id', eventId)
      return !error
    }
    case 'load_in_status': {
      const loadInStatus = (payload.load_in_status as string | null) ?? null
      const { error } = await supabase
        .from('booth_applications')
        .update({ load_in_status: loadInStatus })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      if (error) return false

      if (loadInStatus !== 'late') return true

      const vendorId = await resolveVendorId(
        supabase,
        eventId,
        applicationId,
        payload.vendorId
      )
      if (!vendorId) return false
      return applyLateLoadInReliability(reliabilityAdmin, vendorId)
    }
    case 'raffle_donation': {
      const { error } = await supabase
        .from('booth_applications')
        .update({ raffle_donation_received: Boolean(payload.raffle_donation_received) })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      return !error
    }
    case 'early_exit': {
      const { error } = await supabase
        .from('booth_applications')
        .update({
          left_early: true,
          early_departure_notes: (payload.early_departure_notes as string | null) ?? null,
        })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      if (error) return false

      const vendorId = await resolveVendorId(
        supabase,
        eventId,
        applicationId,
        payload.vendorId
      )
      if (!vendorId) return false
      return applyEarlyExitReliability(reliabilityAdmin, vendorId)
    }
    case 'floor_plan_doc_patch':
      // Not implemented yet — keep queued until server-side layout patch lands.
      return false
    default:
      return false
  }
}
