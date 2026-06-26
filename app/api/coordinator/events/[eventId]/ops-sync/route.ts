import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createClient } from '@/lib/supabase/server'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'
import { computeVendorReliabilityScore } from '@/lib/vendor-reliability'

const PAYMENT_STATUS_UPDATE_KEYS = new Set(['payment_status', 'application_payment_status'])

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

  for (const mutation of mutations) {
    if (mutation.eventId !== eventId) {
      conflicts.push({ id: mutation.id, reason: 'event_mismatch' })
      continue
    }

    try {
      const applied = await applyMutation(supabase, eventId, mutation)
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

async function applyMutation(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
      const raw = (payload.updates ?? {}) as Record<string, unknown>
      const updates = Object.fromEntries(
        Object.entries(raw).filter(([key]) => PAYMENT_STATUS_UPDATE_KEYS.has(key))
      )
      if (Object.keys(updates).length === 0) return false
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

      const vendorId = payload.vendorId as string | undefined
      if (vendorId && loadInStatus === 'late') {
        await applyLateArrivalReliabilityPatch(supabase, vendorId)
      }
      return true
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

      const vendorId = payload.vendorId as string | undefined
      if (vendorId) {
        await applyEarlyExitReliabilityPatch(supabase, vendorId)
      }
      return true
    }
    case 'floor_plan_doc_patch':
      // Layout persistence requires full room payload — queued for a future pass.
      return false
    default:
      return false
  }
}

async function applyLateArrivalReliabilityPatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vendorId: string
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('late_arrival_count, no_show_count, left_early_count, poor_cleanup_strike_count')
    .eq('id', vendorId)
    .single()
  if (!profile) return

  const lateArrivalCount = (profile.late_arrival_count ?? 0) + 1
  const reliabilityScore = computeVendorReliabilityScore({
    no_show_count: profile.no_show_count,
    left_early_count: profile.left_early_count,
    late_arrival_count: lateArrivalCount,
    poor_cleanup_strike_count: profile.poor_cleanup_strike_count,
  })
  await supabase
    .from('profiles')
    .update({ late_arrival_count: lateArrivalCount, reliability_score: reliabilityScore })
    .eq('id', vendorId)
}

async function applyEarlyExitReliabilityPatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vendorId: string
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('late_arrival_count, no_show_count, left_early_count, poor_cleanup_strike_count')
    .eq('id', vendorId)
    .single()
  if (!profile) return

  const leftEarlyCount = (profile.left_early_count ?? 0) + 1
  const reliabilityScore = computeVendorReliabilityScore({
    no_show_count: profile.no_show_count,
    left_early_count: leftEarlyCount,
    late_arrival_count: profile.late_arrival_count,
    poor_cleanup_strike_count: profile.poor_cleanup_strike_count,
  })
  await supabase
    .from('profiles')
    .update({ left_early_count: leftEarlyCount, reliability_score: reliabilityScore })
    .eq('id', vendorId)
}
