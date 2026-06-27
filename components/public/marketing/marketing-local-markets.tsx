import Link from 'next/link'
import { INDEXABLE_MARKET_CITY_SLUGS, getMarketCitySeoPage } from '@/lib/seo/market-city-pages'

const FEATURED_CITY_SLUGS = ['edmonton', 'calgary', 'red-deer', 'lethbridge'] as const

export function MarketingLocalMarkets() {
  const cities = FEATURED_CITY_SLUGS.map((slug) => getMarketCitySeoPage(slug)).filter(
    (city) => city != null,
  )

  return (
    <section className="border-t border-stone-200/60 bg-linen px-4 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Makers markets across Alberta
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Browse city guides with confirmed vendor counts, weekend listings, and vendor application
            pages — no account required.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cities.map((city) => (
            <Link
              key={city.slug}
              href={`/markets/${city.slug}`}
              className="rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-forest/30"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {city.label}
              </p>
              <p className="mt-2 text-base font-bold text-foreground">{city.headline}</p>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{city.intro}</p>
            </Link>
          ))}
        </div>

        {INDEXABLE_MARKET_CITY_SLUGS.length > FEATURED_CITY_SLUGS.length ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Also covering{' '}
            {INDEXABLE_MARKET_CITY_SLUGS.filter(
              (slug) => !FEATURED_CITY_SLUGS.includes(slug as (typeof FEATURED_CITY_SLUGS)[number]),
            )
              .map((slug) => getMarketCitySeoPage(slug)?.label.split(',')[0])
              .filter(Boolean)
              .join(', ')}
            .
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link href="/discover" className="font-semibold text-forest hover:underline">
            Open discover map →
          </Link>
          <Link href="/legal/guides" className="font-semibold text-forest hover:underline">
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
