import type { DateFilterPreset } from '@/lib/shopper/discover-date'
import {
  filterEventsByDate,
  filterEventsByDateRange,
  filterEventsByListingType,
  filterEventsByWeekend,
  getThisMonthEndDate,
  getThisWeekEndDate,
} from '@/lib/shopper/events'
import type { Event, EventListingType } from '@/types/database'

/** Shared date + listing filter used by Discover list/map and vendor search API. */
export function filterDiscoverEventsByScope(
  events: Event[],
  opts: {
    datePreset: DateFilterPreset
    filterDate: Date
    listingType?: EventListingType
  }
): Event[] {
  const listingType = opts.listingType ?? 'community_market'
  const scoped = filterEventsByListingType(events, listingType)
  const { datePreset, filterDate } = opts

  if (datePreset === 'weekend' || datePreset === 'next_weekend') {
    return filterEventsByWeekend(scoped, filterDate)
  }
  if (datePreset === 'this_week') {
    return filterEventsByDateRange(scoped, filterDate, getThisWeekEndDate(filterDate))
  }
  if (datePreset === 'this_month') {
    return filterEventsByDateRange(scoped, filterDate, getThisMonthEndDate(filterDate))
  }
  return filterEventsByDate(scoped, filterDate)
}
