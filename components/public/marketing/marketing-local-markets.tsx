import Link from 'next/link'
import {
  FEATURED_CITY_SLUGS,
  type FeaturedCityMarketCounts,
} from '@/lib/marketing/city-market-counts'
import { resolveDetectedCity } from '@/lib/marketing/ip-geo-target'
import {
  INDEXABLE_MARKET_CITY_SLUGS,
  getMarketCitySeoPage,
  getMarketCityShortName,
} from '@/lib/seo/market-city-pages'
import { LocationDiscoverySearchBar } from '@/components/public/marketing/location-discovery-search-bar'

export interface MarketingLocalMarketsProps {
  /** IP-detected or simulated city name (e.g. "Edmonton"). Falls back to Edmonton when null. */
  detectedCity?: string | null
  /** Live weekend market counts within 50 km of each featured hub city. */
  cityCounts?: FeaturedCityMarketCounts
}

function formatActiveMarketCount(count: number): string {
  if (count === 0) return 'Markets this weekend'
  if (count === 1) return '1 Active Market'
  return `${count} Active Markets`
}

export function MarketingLocalMarkets({
  detectedCity = null,
  cityCounts,
}: MarketingLocalMarketsProps) {
  const cityName = resolveDetectedCity(detectedCity)
  const counts = cityCounts ?? Object.fromEntries(FEATURED_CITY_SLUGS.map((slug) => [slug, 0])) as FeaturedCityMarketCounts

  const secondaryCities = INDEXABLE_MARKET_CITY_SLUGS.filter(
    (slug) => !FEATURED_CITY_SLUGS.includes(slug as (typeof FEATURED_CITY_SLUGS)[number]),
  )
    .map((slug) => getMarketCityShortName(slug))
    .filter(Boolean)

  return (
    <section className="border-t border-stone-200/60 bg-linen px-4 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            🎪 Find Active Local Markets in {cityName} This Weekend
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Browse artisan markets, craft fairs, and community pop-ups happening right in your
            neighborhood.
          </p>
        </div>

        <LocationDiscoverySearchBar detectedCity={cityName} />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_CITY_SLUGS.map((slug) => {
            const city = getMarketCitySeoPage(slug)
            if (!city) return null
            const shortName = getMarketCityShortName(slug)
            const activeCount = counts[slug] ?? 0

            return (
              <Link
                key={slug}
                href={`/markets/${slug}/this-weekend`}
                className="flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div>
                  <p className="text-xl font-bold text-slate-900">{shortName}</p>
                  <span className="mt-2 inline-flex w-max rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {formatActiveMarketCount(activeCount)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {secondaryCities.length > 0 ? (
          <p className="mt-8 border-t border-gray-100 pt-6 text-center text-sm tracking-wide text-slate-500">
            Also active in: {secondaryCities.join(' • ')}.
          </p>
        ) : null}
      </div>
    </section>
  )
}
