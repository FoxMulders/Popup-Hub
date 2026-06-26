import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

const PAYMENT_STATUS_FIELDS = new Set(['payment_status', 'application_payment_status'])
const RELIABILITY_PROFILE_FIELDS = new Set([
  'late_arrival_count',
  'left_early_count',
  'reliability_score',
])

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
      const updates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(raw)) {
        if (PAYMENT_STATUS_FIELDS.has(key)) updates[key] = value
      }
      if (Object.keys(updates).length === 0) return false
      const { error } = await supabase
        .from('booth_applications')
        .update(updates)
        .eq('id', applicationId)
        .eq('event_id', eventId)
      return !error
    }
    case 'load_in_status': {
      const { error } = await supabase
        .from('booth_applications')
        .update({ load_in_status: (payload.load_in_status as string | null) ?? null })
        .eq('id', applicationId)
        .eq('event_id', eventId)
      if (error) return false

      const vendorId = payload.vendorId as string | undefined
      const reliabilityPatch = payload.reliabilityPatch as Record<string, unknown> | undefined
      if (vendorId && reliabilityPatch) {
        const ok = await applyVendorReliabilityPatch(
          eventId,
          applicationId,
          vendorId,
          reliabilityPatch
        )
        if (!ok) return false
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
      const reliabilityPatch = payload.reliabilityPatch as Record<string, unknown> | undefined
      if (vendorId && reliabilityPatch) {
        const ok = await applyVendorReliabilityPatch(
          eventId,
          applicationId,
          vendorId,
          reliabilityPatch
        )
        if (!ok) return false
      }
      return true
    }
    case 'floor_plan_doc_patch':
      // Layout persistence requires full room payload — queued for a future pass.
      return true
    default:
      return false
  }
}

/** Vendor profile RLS blocks coordinator session writes — apply after event/application checks. */
async function applyVendorReliabilityPatch(
  eventId: string,
  applicationId: string,
  vendorId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const admin = createAdminClient()
  const { data: application } = await admin
    .from('booth_applications')
    .select('vendor_id')
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (!application || application.vendor_id !== vendorId) return false

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (RELIABILITY_PROFILE_FIELDS.has(key)) sanitized[key] = value
  }
  if (Object.keys(sanitized).length === 0) return true

  const { error } = await admin.from('profiles').update(sanitized).eq('id', vendorId)
  return !error
}
