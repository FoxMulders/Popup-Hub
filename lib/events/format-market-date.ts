import { format, parseISO } from 'date-fns'
import { resolveEventScheduleDays } from '@/lib/events/event-schedule-days'
import type { Event } from '@/types/database'

/** Human-readable market date(s), e.g. "Saturday, May 23, 2026" or "Saturday, May 23, 2026 & Sunday, May 24, 2026". */
export function formatMarketDateDisplay(
  event: Pick<Event, 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'>
): string {
  const days = resolveEventScheduleDays(event)
  return days
    .map((day) => {
      try {
        return format(parseISO(day.date), 'EEEE, MMM d, yyyy')
      } catch {
        return day.label
      }
    })
    .join(' & ')
}
