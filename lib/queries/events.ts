import type { Event, EventStatus } from '@/types/database'
import { safeEventTimestamp } from '@/lib/format/safe-event-date'

export const OPEN_EVENT_STATUSES = ['published', 'active'] as const satisfies readonly EventStatus[]

export type OpenEventStatus = (typeof OPEN_EVENT_STATUSES)[number]

export type EventDisplayStatus = EventStatus | 'archived' | 'full'

type EventTimingFields = Pick<Event, 'start_at' | 'end_at' | 'status'>

export function getEventEndDate(event: Pick<Event, 'end_at' | 'start_at'>): Date {
  return new Date(event.end_at || event.start_at)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** True when the market day has passed (UI archive), regardless of DB status. */
export function isEventArchived(event: EventTimingFields, now: Date = new Date()): boolean {
  if (event.status === 'completed' || event.status === 'cancelled') {
    return true
  }

  const endDay = startOfDay(getEventEndDate(event))
  const today = startOfDay(now)
  return endDay < today
}

/** Markets vendors can browse and apply to (open status + not past end date). */
export function isEventOpenForApplications(
  event: EventTimingFields,
  now: Date = new Date()
): boolean {
  if (!OPEN_EVENT_STATUSES.includes(event.status as OpenEventStatus)) {
    return false
  }

  return !isEventArchived(event, now)
}

export function getEventDisplayStatus(
  event: EventTimingFields,
  now?: Date,
  options?: { isFullyBooked?: boolean }
): EventDisplayStatus {
  if (isEventArchived(event, now)) {
    return 'archived'
  }

  if (options?.isFullyBooked && isEventOpenForApplications(event, now)) {
    return 'full'
  }

  return event.status
}

export function partitionEventsByPhase<T extends EventTimingFields>(
  events: T[],
  now?: Date
): { active: T[]; archived: T[] } {
  const active: T[] = []
  const archived: T[] = []

  for (const event of events) {
    if (isEventArchived(event, now)) {
      archived.push(event)
    } else {
      active.push(event)
    }
  }

  return { active, archived }
}

/** Past vendor directory markets the signed-in vendor applied to (any booth application). */
export function filterVendorParticipatedArchivedEvents<T extends { id: string }>(
  archivedEvents: T[],
  vendorEventIds: Iterable<string>,
): T[] {
  const participated = new Set(vendorEventIds)
  return archivedEvents.filter((event) => participated.has(event.id))
}

export function sortEventsByStartAsc<T extends Pick<Event, 'start_at'>>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => safeEventTimestamp(a.start_at) - safeEventTimestamp(b.start_at)
  )
}

export function sortEventsByStartDesc<T extends Pick<Event, 'start_at'>>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => safeEventTimestamp(b.start_at) - safeEventTimestamp(a.start_at)
  )
}

/** Exclude QA scenario markets from public patron/vendor catalog queries. */
export function excludeTestMarkets<T extends { eq: (column: string, value: boolean) => T }>(
  query: T
): T {
  return query.eq('is_test', false)
}

/** Vendor-facing markets query statuses (active feed + history). */
export const VENDOR_MARKET_STATUSES: EventStatus[] = [
  'published',
  'active',
  'completed',
]

export const VENDOR_EVENT_SELECT = `
  *,
  coordinator:profiles!events_coordinator_id_fkey(id, full_name, email, avatar_url, reliability_score, recent_late_cancellation_at),
  category_limits:event_category_limits(
    *,
    category:categories(id, name)
  ),
  event_days(*)
`

/** Server-side vendor apply — use * on events/profiles so missing optional columns do not break the query. */
export const VENDOR_APPLY_EVENT_SELECT = `
  *,
  event_days(id, event_id, date, start_time, end_time, sort_order),
  coordinator:profiles!events_coordinator_id_fkey(*)
`
