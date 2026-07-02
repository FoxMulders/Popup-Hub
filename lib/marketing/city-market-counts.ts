import { getMarketCitySeoPage } from '@/lib/seo/market-city-pages'
import {
  filterEventsByRadius,
  filterEventsByWeekend,
  sortEventsByDistance,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'

export const FEATURED_CITY_SLUGS = ['edmonton', 'calgary', 'red-deer', 'lethbridge'] as const
export type FeaturedCitySlug = (typeof FEATURED_CITY_SLUGS)[number]

const CITY_RADIUS_KM = 50

export type FeaturedCityMarketCounts = Record<FeaturedCitySlug, number>

export function buildFeaturedCityMarketCounts(events: Event[]): FeaturedCityMarketCounts {
  const weekendAnchor = new Date()
  const counts = {} as FeaturedCityMarketCounts

  for (const slug of FEATURED_CITY_SLUGS) {
    const city = getMarketCitySeoPage(slug)
    if (!city) {
      counts[slug] = 0
      continue
    }

    const origin = { lat: city.lat, lng: city.lng }
    const withDistance = sortEventsByDistance(events, origin)
    const weekendScoped = filterEventsByWeekend(withDistance, weekendAnchor)
    const nearby = filterEventsByRadius(weekendScoped, CITY_RADIUS_KM)
    counts[slug] = nearby.length
  }

  return counts
}
