import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

type BoothApplicationClient = Pick<SupabaseClient, 'from'>

async function updateBoothApplication(
  supabase: BoothApplicationClient,
  eventId: string,
  applicationId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  if (!applicationId) return false

  const { data, error } = await supabase
    .from('booth_applications')
    .update(updates)
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .select('id')
    .maybeSingle()

  return !error && data !== null
}

export async function applyCoordinatorOpsMutation(
  supabase: BoothApplicationClient,
  eventId: string,
  mutation: PendingCoordinatorMutation
): Promise<boolean> {
  const { type, payload } = mutation
  const applicationId = String(payload.applicationId ?? '')

  switch (type) {
    case 'check_in':
      return updateBoothApplication(supabase, eventId, applicationId, {
        checked_in: Boolean(payload.checked_in),
      })
    case 'payment_status': {
      const updates = (payload.updates ?? {}) as Record<string, unknown>
      return updateBoothApplication(supabase, eventId, applicationId, updates)
    }
    case 'load_in_status': {
      const applied = await updateBoothApplication(supabase, eventId, applicationId, {
        load_in_status: (payload.load_in_status as string | null) ?? null,
      })
      if (!applied) return false

      const vendorId = payload.vendorId as string | undefined
      const reliabilityPatch = payload.reliabilityPatch as
        | { late_arrival_count?: number; reliability_score?: number }
        | undefined
      if (vendorId && reliabilityPatch) {
        const { error } = await supabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
        if (error) return false
      }
      return true
    }
    case 'raffle_donation':
      return updateBoothApplication(supabase, eventId, applicationId, {
        raffle_donation_received: Boolean(payload.raffle_donation_received),
      })
    case 'early_exit': {
      const applied = await updateBoothApplication(supabase, eventId, applicationId, {
        left_early: true,
        early_departure_notes: (payload.early_departure_notes as string | null) ?? null,
      })
      if (!applied) return false

      const vendorId = payload.vendorId as string | undefined
      const reliabilityPatch = payload.reliabilityPatch as
        | { left_early_count?: number; reliability_score?: number }
        | undefined
      if (vendorId && reliabilityPatch) {
        const { error } = await supabase
          .from('profiles')
          .update(reliabilityPatch)
          .eq('id', vendorId)
        if (error) return false
      }
      return true
    }
    case 'floor_plan_doc_patch':
      // Layout persistence requires full room payload — not implemented yet.
      return false
    default:
      return false
  }
}
