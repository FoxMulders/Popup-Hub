import { getCachedDiscoverMarkets } from '@/lib/queries/cached-public-markets'
import { buildFeaturedCityMarketCounts } from '@/lib/marketing/city-market-counts'
import { detectCityFromRequest } from '@/lib/marketing/ip-geo-target'
import { MarketingLocalMarkets } from '@/components/public/marketing/marketing-local-markets'

export async function MarketingLocalMarketsSection() {
  const [detectedCity, events] = await Promise.all([
    detectCityFromRequest(),
    getCachedDiscoverMarkets(),
  ])

  const cityCounts = buildFeaturedCityMarketCounts(events)

  return <MarketingLocalMarkets detectedCity={detectedCity} cityCounts={cityCounts} />
}
