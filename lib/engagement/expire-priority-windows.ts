import type { SupabaseClient } from '@supabase/supabase-js'
import { vendorAccessEqualityUntilFromRelease } from '@/lib/engagement/booth-access'

export interface PriorityWindowExpiryResult {
  releasedSlotCount: number
  eventsUpdated: number
}

export async function expirePriorityWindows(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<PriorityWindowExpiryResult> {
  const nowIso = now.toISOString()

  const { data: expiredSlots, error } = await supabase
    .from('event_booth_slots')
    .select('id, event_id')
    .eq('access_phase', 'priority_exclusive')
    .is('claimed_by_application_id', null)
    .lte('priority_window_ends_at', nowIso)

  if (error) throw error
  if (!expiredSlots?.length) {
    return { releasedSlotCount: 0, eventsUpdated: 0 }
  }

  const slotIds = expiredSlots.map((s) => s.id)
  const eventIds = [...new Set(expiredSlots.map((s) => s.event_id as string))]

  const { error: updateSlotsError } = await supabase
    .from('event_booth_slots')
    .update({
      access_phase: 'public_release',
      public_released_at: nowIso,
      updated_at: nowIso,
    })
    .in('id', slotIds)

  if (updateSlotsError) throw updateSlotsError

  let eventsUpdated = 0
  for (const eventId of eventIds) {
    const { data: event } = await supabase
      .from('events')
      .select('vendor_access_equality_until')
      .eq('id', eventId)
      .single()

    if (event?.vendor_access_equality_until) continue

    const { error: eventError } = await supabase
      .from('events')
      .update({
        vendor_access_equality_until: vendorAccessEqualityUntilFromRelease(now),
      })
      .eq('id', eventId)

    if (!eventError) eventsUpdated += 1
  }

  return {
    releasedSlotCount: slotIds.length,
    eventsUpdated,
  }
}
