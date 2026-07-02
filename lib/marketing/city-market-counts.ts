import {
  filterEventsByListingType,
  filterEventsByRadius,
  filterEventsByWeekend,
  sortEventsByDistance,
} from '@/lib/shopper/events'
import { getMarketCityById } from '@/lib/wizard/market-cities'
import type { Event } from '@/types/database'

const DEFAULT_RADIUS_KM = 50

export function formatActiveMarketCount(count: number): string {
  const label = count === 1 ? 'Active Market' : 'Active Markets'
  return `${count} ${label}`
}

/**
 * Count published/active community markets occurring this weekend within
 * `radiusKm` of each hub city centre.
 */
export function countWeekendMarketsByHub(
  events: Event[],
  hubSlugs: readonly string[],
  radiusKm = DEFAULT_RADIUS_KM,
): Record<string, number> {
  const weekendScoped = filterEventsByWeekend(
    filterEventsByListingType(events, 'community_market'),
    new Date(),
  )

  const counts: Record<string, number> = {}

  for (const slug of hubSlugs) {
    const hub = getMarketCityById(slug)
    const origin = { lat: hub.lat, lng: hub.lng }
    const nearby = filterEventsByRadius(
      sortEventsByDistance(weekendScoped, origin),
      radiusKm,
    )
    counts[slug] = nearby.length
  }

  return counts
}
