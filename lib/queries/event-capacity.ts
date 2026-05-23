import type { SupabaseClient } from '@supabase/supabase-js'
import type { Event, EventCategoryLimit } from '@/types/database'

export type AvailableSlotsRow = {
  category_id: string
  max_slots: number
  approved_count: number
  available: number
}

export type EventCapacitySummary = {
  isFullyBooked: boolean
  totalAvailable: number
  slotsByCategoryId: Record<string, number>
}

export function getVendorEligibleCategoryLimits(event: Pick<Event, 'allow_mlm' | 'category_limits'>) {
  return (event.category_limits ?? []).filter(
    (cl: EventCategoryLimit) => event.allow_mlm || !cl.category?.is_mlm
  )
}

export function parseAvailableSlots(data: unknown): number {
  if (typeof data === 'number') return Math.max(0, data)
  if (!Array.isArray(data) || data.length === 0) return 0

  const row = data[0] as AvailableSlotsRow
  return Math.max(0, row.available ?? 0)
}

export async function fetchCategoryAvailableSlots(
  supabase: SupabaseClient,
  eventId: string,
  categoryId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_event_id: eventId,
    p_category_id: categoryId,
  })

  if (error) return 0
  return parseAvailableSlots(data)
}

export async function fetchEventCapacitySummary(
  supabase: SupabaseClient,
  event: Pick<Event, 'id' | 'allow_mlm' | 'category_limits'>
): Promise<EventCapacitySummary> {
  const limits = getVendorEligibleCategoryLimits(event)
  if (limits.length === 0) {
    return { isFullyBooked: false, totalAvailable: 0, slotsByCategoryId: {} }
  }

  const entries = await Promise.all(
    limits.map(async (limit) => {
      const available = await fetchCategoryAvailableSlots(supabase, event.id, limit.category_id)
      return [limit.category_id, available] as const
    })
  )

  const slotsByCategoryId = Object.fromEntries(entries)
  const totalAvailable = entries.reduce((sum, [, available]) => sum + available, 0)
  const isFullyBooked = limits.every((limit) => (slotsByCategoryId[limit.category_id] ?? 0) <= 0)

  return { isFullyBooked, totalAvailable, slotsByCategoryId }
}

export async function fetchCapacitySummariesForEvents(
  supabase: SupabaseClient,
  events: Array<Pick<Event, 'id' | 'allow_mlm' | 'category_limits'>>
): Promise<Record<string, EventCapacitySummary>> {
  const summaries = await Promise.all(
    events.map(async (event) => [event.id, await fetchEventCapacitySummary(supabase, event)] as const)
  )

  return Object.fromEntries(summaries)
}
