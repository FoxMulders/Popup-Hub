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
  totalMaxSlots: number
  slotsByCategoryId: Record<string, number>
  maxSlotsByCategoryId: Record<string, number>
}

export function formatCapacityRemaining(available: number, max: number): string {
  if (max <= 0) return 'Capacity not set'
  if (available <= 0) return `Full · ${max} max`
  return `${available} of ${max} spots left`
}

export function formatEventCapacitySummary(summary: EventCapacitySummary | undefined): string | null {
  if (!summary || summary.totalMaxSlots <= 0) return null
  return formatCapacityRemaining(summary.totalAvailable, summary.totalMaxSlots)
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
    return {
      isFullyBooked: false,
      totalAvailable: 0,
      totalMaxSlots: 0,
      slotsByCategoryId: {},
      maxSlotsByCategoryId: {},
    }
  }

  const entries = await Promise.all(
    limits.map(async (limit) => {
      const available = await fetchCategoryAvailableSlots(supabase, event.id, limit.category_id)
      return {
        categoryId: limit.category_id,
        available,
        maxSlots: limit.max_slots,
      }
    })
  )

  const slotsByCategoryId = Object.fromEntries(
    entries.map((entry) => [entry.categoryId, entry.available])
  )
  const maxSlotsByCategoryId = Object.fromEntries(
    entries.map((entry) => [entry.categoryId, entry.maxSlots])
  )
  const totalAvailable = entries.reduce((sum, entry) => sum + entry.available, 0)
  const totalMaxSlots = entries.reduce((sum, entry) => sum + entry.maxSlots, 0)
  const isFullyBooked = entries.every((entry) => entry.available <= 0)

  return { isFullyBooked, totalAvailable, totalMaxSlots, slotsByCategoryId, maxSlotsByCategoryId }
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
