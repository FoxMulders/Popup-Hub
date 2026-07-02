import { LocationDiscoveryEngine } from '@/components/public/marketing/location-discovery-engine'
import { countWeekendMarketsByHub } from '@/lib/marketing/city-market-counts'
import {
  detectVisitorCity,
  detectVisitorCitySlug,
  resolveDetectedCity,
} from '@/lib/marketing/detect-visitor-city'
import { getCachedDiscoverMarkets } from '@/lib/queries/cached-public-markets'
import {
  INDEXABLE_MARKET_CITY_SLUGS,
  getMarketCityShortName,
} from '@/lib/seo/market-city-pages'
import { inferMarketCityId } from '@/lib/wizard/market-cities'

const FEATURED_CITY_SLUGS = ['edmonton', 'calgary', 'red-deer', 'lethbridge'] as const

export type MarketingLocalMarketsProps = {
  detectedCity?: string | null
}

export async function MarketingLocalMarkets({ detectedCity }: MarketingLocalMarketsProps = {}) {
  const [resolvedCity, resolvedSlug, events] = await Promise.all([
    detectedCity != null ? Promise.resolve(resolveDetectedCity(detectedCity)) : detectVisitorCity(),
    detectedCity != null
      ? Promise.resolve(inferMarketCityId(detectedCity))
      : detectVisitorCitySlug(),
    getCachedDiscoverMarkets(),
  ])

  const counts = countWeekendMarketsByHub(events, FEATURED_CITY_SLUGS)

  const hubCities = FEATURED_CITY_SLUGS.map((slug) => ({
    slug,
    name: getMarketCityShortName(slug),
    activeCount: counts[slug] ?? 0,
    href: `/markets/${slug}`,
  }))

  const secondaryCityLinks = INDEXABLE_MARKET_CITY_SLUGS.filter(
    (slug) => !FEATURED_CITY_SLUGS.includes(slug as (typeof FEATURED_CITY_SLUGS)[number]),
  ).map((slug) => ({
    name: getMarketCityShortName(slug),
    href: `/markets/${slug}`,
  }))

  return (
    <LocationDiscoveryEngine
      detectedCity={resolvedCity}
      detectedCitySlug={resolvedSlug}
      hubCities={hubCities}
      secondaryCityLinks={secondaryCityLinks}
    />
  )
}
