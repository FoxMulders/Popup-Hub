import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld'
import { publicAppUrl } from '@/lib/url/public-app-url'
import type { MarketCitySeoPage } from '@/lib/seo/market-city-pages'
import {
  filterEventsByRadius,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'

interface MarketCityLandingProps {
  city: MarketCitySeoPage
  events: Event[]
}

export function MarketCityLanding({ city, events }: MarketCityLandingProps) {
  const origin = { lat: city.lat, lng: city.lng }
  const withDistance: EventWithMeta[] = sortEventsByDistance(events, origin)
  const nearby = filterEventsByRadius(withDistance, 50).slice(0, 12)

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Discover Markets', path: '/discover' },
    { name: city.label, path: `/markets/${city.slug}` },
  ])

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: city.headline,
    description: city.description,
    url: publicAppUrl(`/markets/${city.slug}`),
    about: {
      '@type': 'Place',
      name: city.label,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: city.lat,
        longitude: city.lng,
      },
    },
  }

  return (
    <>
      <JsonLdScript data={[breadcrumb, collectionJsonLd]} />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden marketing-hero-mesh text-white">
          <MarketingHeroBackdrop />
          <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:py-20">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">{city.label}</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {city.headline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
              {city.intro}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Link
                href="/discover?when=weekend"
                className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto"
              >
                Browse this weekend
              </Link>
              <Link
                href="/for-vendors"
                className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                Apply as a vendor
              </Link>
            </div>
          </div>
          <div className="marketing-section-divider" aria-hidden />
        </section>

        <section className="bg-cream px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              Upcoming markets near {city.label.split(',')[0]}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Published markets within 50 km — confirmed vendor counts shown on each listing.
            </p>

            {nearby.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map((event) => (
                  <EventCard key={event.id} event={event as Event} href={`/events/${event.id}`} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border bg-white py-14 text-center">
                <p className="text-muted-foreground">
                  No published markets in this area yet — check back soon or browse all of Alberta.
                </p>
                <Link
                  href="/discover"
                  className="mt-4 inline-flex text-sm font-semibold text-forest hover:underline"
                >
                  Open discover map →
                </Link>
              </div>
            )}

            <p className="mt-10 text-center text-sm text-muted-foreground">
              Hosting a market in {city.label.split(',')[0]}?{' '}
              <Link href="/for-organizers" className="font-semibold text-forest hover:underline">
                Publish on Popup Hub →
              </Link>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
