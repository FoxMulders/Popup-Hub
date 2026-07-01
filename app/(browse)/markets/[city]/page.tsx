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
import { listMarketCityIntentPages } from '@/lib/seo/market-city-intents'

export const revalidate = 60

type Props = {
  params: Promise<{ city: string }>
}

export function generateStaticParams() {
  return INDEXABLE_MARKET_CITY_SLUGS.map((city) => ({ city }))
}

export async function generateMetadata({ params }: Props) {
  const { city: citySlug } = await params
  const city = getMarketCitySeoPage(citySlug)

  if (!city) {
    return buildPublicMetadata({
      title: 'Markets',
      description: 'Discover markets published on Popup Hub near you.',
      path: `/markets/${citySlug}`,
      noIndex: true,
    })
  }

  return buildPublicMetadata({
    title: city.headline,
    description: city.description,
    path: `/markets/${city.slug}`,
    keywords: city.keywords,
    imageUrl: `/markets/${city.slug}/opengraph-image`,
  })
}

export default async function MarketCityPage({ params }: Props) {
  const { city: citySlug } = await params

  if (!isIndexableMarketCitySlug(citySlug)) {
    notFound()
  }

  const city = getMarketCitySeoPage(citySlug)
  if (!city) notFound()

  const events = await getCachedDiscoverMarkets()

  return (
    <MarketCityLanding
      city={city}
      events={events}
      siblingIntents={listMarketCityIntentPages(city)}
    />
  )
}
