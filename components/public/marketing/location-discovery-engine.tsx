import Link from 'next/link'
import { formatActiveMarketCount } from '@/lib/marketing/city-market-counts'
import { LocationSearchBar } from '@/components/public/marketing/location-search-bar'

export type HubCityCard = {
  slug: string
  name: string
  activeCount: number
  href: string
}

export type SecondaryCityLink = {
  name: string
  href: string
}

export type LocationDiscoveryEngineProps = {
  detectedCity: string
  detectedCitySlug: string
  hubCities: HubCityCard[]
  secondaryCityLinks: SecondaryCityLink[]
}

export function LocationDiscoveryEngine({
  detectedCity,
  detectedCitySlug,
  hubCities,
  secondaryCityLinks,
}: LocationDiscoveryEngineProps) {
  return (
    <section className="border-t border-stone-200/60 bg-linen px-4 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            🎪 Find Active Local Markets in {detectedCity} This Weekend
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Browse artisan markets, craft fairs, and community pop-ups happening right in your
            neighborhood.
          </p>
        </div>

        <div className="mt-8">
          <LocationSearchBar defaultQuery={detectedCity} detectedCitySlug={detectedCitySlug} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {hubCities.map((city) => (
            <Link
              key={city.slug}
              href={city.href}
              className="flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                <p className="text-xl font-bold text-slate-900">{city.name}</p>
                <span className="mt-2 inline-block w-max rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {formatActiveMarketCount(city.activeCount)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {secondaryCityLinks.length > 0 ? (
          <p className="mt-8 border-t border-gray-100 pt-6 text-center text-sm tracking-wide text-slate-500">
            Also active in:{' '}
            {secondaryCityLinks.map((city, index) => (
              <span key={city.href}>
                {index > 0 ? (
                  <span aria-hidden className="mx-1.5">
                    •
                  </span>
                ) : null}
                <Link
                  href={city.href}
                  className="transition-colors hover:text-slate-700 hover:underline"
                >
                  {city.name}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/legal/guides"
            className="font-semibold text-forest hover:underline"
          >
            Read market guides →
          </Link>
          <Link href="/check" className="font-semibold text-forest hover:underline">
            HubGuard organizer search →
          </Link>
        </div>
      </div>
    </section>
  )
}
