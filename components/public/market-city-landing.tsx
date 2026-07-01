import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld'
import type { MarketCityIntentPage } from '@/lib/seo/market-city-intents'
import { buildMarketCityIntentPath } from '@/lib/seo/market-city-intents'
import { getMarketCityShortName } from '@/lib/seo/market-city-pages'
import type { MarketCitySeoPage } from '@/lib/seo/market-city-pages'
import { publicAppUrl } from '@/lib/url/public-app-url'
import {
  filterEventsByRadius,
  filterEventsByWeekend,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'
import {
  noPopupHubPublishedInCity,
  popupHubDiscoveryPromo,
} from '@/lib/copy/popup-hub-discovery'

interface MarketCityLandingProps {
  city: MarketCitySeoPage
  events: Event[]
  intent?: MarketCityIntentPage
  siblingIntents?: MarketCityIntentPage[]
}

function buildDiscoverHref(intent?: MarketCityIntentPage): string {
  if (!intent?.discoverWhen) return '/discover'
  if (intent.discoverWhen === 'weekend') return '/discover?when=weekend'
  return '/discover?when=this_month'
}

export function MarketCityLanding({
  city,
  events,
  intent,
  siblingIntents = [],
}: MarketCityLandingProps) {
  const origin = { lat: city.lat, lng: city.lng }
  const withDistance: EventWithMeta[] = sortEventsByDistance(events, origin)
  const weekendScoped =
    intent?.discoverWhen === 'weekend'
      ? filterEventsByWeekend(withDistance, new Date())
      : withDistance
  const nearby = filterEventsByRadius(weekendScoped, 50).slice(0, 12)
  const shortName = getMarketCityShortName(city.slug)
  const headline = intent?.headline ?? city.headline
  const intro = intent?.intro ?? city.intro
  const pagePath = intent
    ? buildMarketCityIntentPath(city.slug, intent.slug)
    : `/markets/${city.slug}`

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Discover Markets', path: '/discover' },
    { name: city.label, path: `/markets/${city.slug}` },
    ...(intent ? [{ name: intent.headline, path: pagePath }] : []),
  ])

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: headline,
    description: intent?.description ?? city.description,
    url: publicAppUrl(pagePath),
    about: {
      '@type': 'Place',
      name: city.label,
      address: {
        '@type': 'PostalAddress',
        addressLocality: shortName,
        addressRegion: 'AB',
        addressCountry: 'CA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: city.lat,
        longitude: city.lng,
      },
    },
    ...(nearby.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: nearby.length,
            itemListElement: nearby.map((event, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: publicAppUrl(`/events/${event.id}`),
              name: event.name,
            })),
          },
        }
      : {}),
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
              {headline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
              {intro}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Link
                href={buildDiscoverHref(intent)}
                className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto"
              >
                {intent?.discoverWhen === 'weekend' ? 'Browse this weekend' : 'Browse markets'}
              </Link>
              <Link
                href={intent?.vendorFocus ? '/signup?role=vendor' : '/for-vendors'}
                className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                {intent?.vendorFocus ? 'Create vendor passport' : 'Apply as a vendor'}
              </Link>
              {intent?.vendorFocus ? (
                <Link
                  href="/check"
                  className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
                >
                  Verify organizer (HubGuard)
                </Link>
              ) : null}
            </div>
          </div>
          <div className="marketing-section-divider" aria-hidden />
        </section>

        {siblingIntents.length > 0 ? (
          <section className="border-b border-stone-200/60 bg-linen px-4 py-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Also in {shortName}:
              </span>
              {siblingIntents.map((sibling) => (
                <Link
                  key={sibling.slug}
                  href={buildMarketCityIntentPath(city.slug, sibling.slug)}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:border-forest/40 hover:text-forest"
                >
                  {sibling.headline}
                </Link>
              ))}
              <Link
                href={`/markets/${city.slug}`}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:border-forest/40 hover:text-forest"
              >
                All Popup Hub markets in {shortName}
              </Link>
            </div>
          </section>
        ) : null}

        <section className="bg-cream px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              {intent?.discoverWhen === 'weekend'
                ? `Popup Hub markets this weekend near ${shortName}`
                : `Upcoming Popup Hub markets near ${shortName}`}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Markets published on Popup Hub within 50 km — confirmed vendor counts shown on each
              listing.
            </p>

            {nearby.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map((event) => (
                  <EventCard key={event.id} event={event as Event} href={`/events/${event.id}`} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border bg-white py-14 text-center">
                <p className="text-muted-foreground">{noPopupHubPublishedInCity}</p>
                <p className="mx-auto mt-3 max-w-lg px-4 text-sm text-muted-foreground">
                  {popupHubDiscoveryPromo}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
                  <Link href="/discover" className="font-semibold text-forest hover:underline">
                    Open discover map →
                  </Link>
                  <Link
                    href={buildMarketCityIntentPath(city.slug, 'vendor-applications')}
                    className="font-semibold text-forest hover:underline"
                  >
                    {shortName} vendor applications →
                  </Link>
                  <Link href="/check" className="font-semibold text-forest hover:underline">
                    HubGuard organizer search →
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="font-semibold text-foreground">For vendors</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Apply with one passport, verify organizers before paying booth fees, and track open
                  markets near {shortName}.
                </p>
                <Link href="/for-vendors" className="mt-3 inline-flex text-sm font-semibold text-forest hover:underline">
                  Vendor hub →
                </Link>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="font-semibold text-foreground">For organizers</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hosting a market in {shortName}? Publish listings, collect applications, and drive
                  patron discovery from one dashboard.
                </p>
                <Link
                  href="/for-organizers"
                  className="mt-3 inline-flex text-sm font-semibold text-forest hover:underline"
                >
                  Organizer software →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
