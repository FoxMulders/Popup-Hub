import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import {
  applyVendorEarlyExitStrike,
  applyVendorLateArrivalStrike,
  shouldApplyEarlyExitStrike,
  shouldApplyLateArrivalStrike,
} from '@/lib/coordinator/ops-sync-vendor-reliability'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'
import type { ApplicationPaymentStatus, PaymentStatus } from '@/types/database'

const PAYMENT_STATUS_FIELDS = new Set([
  'payment_status',
  'application_payment_status',
])

function pickPaymentStatusUpdates(
  raw: Record<string, unknown>
): Record<string, PaymentStatus | ApplicationPaymentStatus> {
  const updates: Record<string, PaymentStatus | ApplicationPaymentStatus> = {}
  for (const key of PAYMENT_STATUS_FIELDS) {
    if (key in raw) {
      updates[key] = raw[key] as PaymentStatus | ApplicationPaymentStatus
    }
  }
  return updates
}

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
      const updates = pickPaymentStatusUpdates(
        (payload.updates ?? {}) as Record<string, unknown>
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
      const nextStatus = (payload.load_in_status as string | null) ?? null
      const { data: application, error: readError } = await supabase
        .from('booth_applications')
        .select('load_in_status, vendor_id')
        .eq('id', applicationId)
        .eq('event_id', eventId)
        .maybeSingle()
      if (readError || !application) return false

      const { error } = await supabase
        .from('booth_applications')
        .update({ load_in_status: nextStatus })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      if (error) return false

      if (
        application.vendor_id &&
        shouldApplyLateArrivalStrike(application.load_in_status, nextStatus)
      ) {
        const admin = createAdminClient()
        const reliabilityApplied = await applyVendorLateArrivalStrike(
          admin,
          application.vendor_id
        )
        if (!reliabilityApplied) return false
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
      const { data: application, error: readError } = await supabase
        .from('booth_applications')
        .select('left_early, vendor_id')
        .eq('id', applicationId)
        .eq('event_id', eventId)
        .maybeSingle()
      if (readError || !application) return false

      const { error } = await supabase
        .from('booth_applications')
        .update({
          left_early: true,
          early_departure_notes: (payload.early_departure_notes as string | null) ?? null,
        })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      if (error) return false

      if (
        application.vendor_id &&
        shouldApplyEarlyExitStrike(Boolean(application.left_early))
      ) {
        const admin = createAdminClient()
        const reliabilityApplied = await applyVendorEarlyExitStrike(
          admin,
          application.vendor_id
        )
        if (!reliabilityApplied) return false
      }
      return true
    }
    case 'floor_plan_doc_patch':
      // Layout persistence requires full room payload — not yet implemented.
      return false
    default:
      return false
  }
}
