import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

export function rowUpdateSucceeded<T>(data: T | null, error: unknown): data is T {
  return !error && data !== null
}

async function updateApplicationRow(
  supabase: SupabaseClient,
  eventId: string,
  applicationId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('booth_applications')
    .update(updates)
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .select('id')
    .maybeSingle()
  return rowUpdateSucceeded(data, error)
}

export async function applyCoordinatorOpsMutation(
  supabase: SupabaseClient,
  eventId: string,
  mutation: PendingCoordinatorMutation
): Promise<boolean> {
  const { type, payload } = mutation
  const applicationId = String(payload.applicationId ?? '')
  if (!applicationId) return false

  switch (type) {
    case 'check_in':
      return updateApplicationRow(supabase, eventId, applicationId, {
        checked_in: Boolean(payload.checked_in),
      })
    case 'payment_status':
      return updateApplicationRow(
        supabase,
        eventId,
        applicationId,
        (payload.updates ?? {}) as Record<string, unknown>
      )
    case 'load_in_status': {
      const applied = await updateApplicationRow(supabase, eventId, applicationId, {
        load_in_status: (payload.load_in_status as string | null) ?? null,
      })
      if (!applied) return false

      const vendorId = payload.vendorId as string | undefined
      const reliabilityPatch = payload.reliabilityPatch as
        | { late_arrival_count?: number; reliability_score?: number }
        | undefined
      if (vendorId && reliabilityPatch) {
        const { data, error } = await supabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
          .select('id')
          .maybeSingle()
        return rowUpdateSucceeded(data, error)
      }
      return true
    }
    case 'raffle_donation':
      return updateApplicationRow(supabase, eventId, applicationId, {
        raffle_donation_received: Boolean(payload.raffle_donation_received),
      })
    case 'early_exit': {
      const applied = await updateApplicationRow(supabase, eventId, applicationId, {
        left_early: true,
        early_departure_notes: (payload.early_departure_notes as string | null) ?? null,
      })
      if (!applied) return false

      const vendorId = payload.vendorId as string | undefined
      const reliabilityPatch = payload.reliabilityPatch as
        | { left_early_count?: number; reliability_score?: number }
        | undefined
      if (vendorId && reliabilityPatch) {
        const { data, error } = await supabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
          .select('id')
          .maybeSingle()
        return rowUpdateSucceeded(data, error)
      }
      return true
    }
    case 'floor_plan_doc_patch':
      // Not implemented — keep queued until layout offline persistence exists.
      return false
    default:
      return false
  }
}
