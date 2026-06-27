import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getCachedDiscoverMarkets,
} from '@/lib/queries/cached-public-markets'
import { MarketCityLanding } from '@/components/public/market-city-landing'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import {
  getMarketCitySeoPage,
  INDEXABLE_MARKET_CITY_SLUGS,
  isIndexableMarketCitySlug,
} from '@/lib/seo/market-city-pages'
import {
  getMarketCityIntentPage,
  isMarketCityIntentSlug,
  MARKET_CITY_INTENT_SLUGS,
} from '@/lib/seo/market-city-intents'

export const revalidate = 60

type Props = {
  params: Promise<{ city: string; intent: string }>
}

export function generateStaticParams() {
  return INDEXABLE_MARKET_CITY_SLUGS.flatMap((city) =>
    MARKET_CITY_INTENT_SLUGS.map((intent) => ({ city, intent })),
  )
}

export async function generateMetadata({ params }: Props) {
  const { city: citySlug, intent: intentSlug } = await params
  const city = getMarketCitySeoPage(citySlug)
  const intent = city ? getMarketCityIntentPage(city, intentSlug) : null

  if (!city || !intent) {
    return buildPublicMetadata({
      title: 'Markets — Popup Hub',
      description: 'Discover makers markets near you on Popup Hub.',
      path: `/markets/${citySlug}/${intentSlug}`,
      noIndex: true,
    })
  }

  return buildPublicMetadata({
    title: `${intent.headline} — Popup Hub`,
    description: intent.description,
    path: `/markets/${city.slug}/${intent.slug}`,
    keywords: intent.keywords,
  })
}

export default async function MarketCityIntentPage({ params }: Props) {
  const { city: citySlug, intent: intentSlug } = await params

  if (!isIndexableMarketCitySlug(citySlug) || !isMarketCityIntentSlug(intentSlug)) {
    notFound()
  }

  const city = getMarketCitySeoPage(citySlug)
  const intent = city ? getMarketCityIntentPage(city, intentSlug) : null
  if (!city || !intent) notFound()

  const events = await getCachedDiscoverMarkets()

  return (
    <>
      <MarketCityLanding
        city={city}
        events={events}
        intent={intent}
        siblingIntents={MARKET_CITY_INTENT_SLUGS.filter((slug) => slug !== intent.slug).map(
          (slug) => getMarketCityIntentPage(city, slug)!,
        )}
      />
      <div className="sr-only">
        <Link href={`/markets/${city.slug}`}>All markets in {city.label}</Link>
      </div>
    </>
  )
}
