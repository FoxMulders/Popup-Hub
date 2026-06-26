import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

const PAYMENT_STATUS_FIELDS = new Set(['payment_status', 'application_payment_status'])

const VENDOR_RELIABILITY_FIELDS = new Set([
  'late_arrival_count',
  'left_early_count',
  'reliability_score',
])

export function pickPaymentStatusUpdates(
  updates: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => PAYMENT_STATUS_FIELDS.has(key))
  )
}

export function pickVendorReliabilityPatch(
  patch: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!patch) return undefined
  const picked = Object.fromEntries(
    Object.entries(patch).filter(([key]) => VENDOR_RELIABILITY_FIELDS.has(key))
  )
  return Object.keys(picked).length > 0 ? picked : undefined
}

export function hasPaymentStatusUpdates(updates: Record<string, unknown>): boolean {
  return Object.keys(pickPaymentStatusUpdates(updates)).length > 0
}

export type OpsSyncSupabase = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

export async function applyCoordinatorOpsMutation(
  supabase: OpsSyncSupabase,
  adminSupabase: OpsSyncSupabase,
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
      const updates = pickPaymentStatusUpdates((payload.updates ?? {}) as Record<string, unknown>)
      if (!hasPaymentStatusUpdates(updates)) return false
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
      const reliabilityPatch = pickVendorReliabilityPatch(
        payload.reliabilityPatch as Record<string, unknown> | undefined
      )
      if (vendorId && reliabilityPatch) {
        const { error: profileError } = await adminSupabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
        if (profileError) return false
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
      const reliabilityPatch = pickVendorReliabilityPatch(
        payload.reliabilityPatch as Record<string, unknown> | undefined
      )
      if (vendorId && reliabilityPatch) {
        const { error: profileError } = await adminSupabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
        if (profileError) return false
      }
      return true
    }
    case 'floor_plan_doc_patch':
      return false
    default:
      return false
  }
}
