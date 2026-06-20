import { getMarketCityById, MARKET_CITIES, type MarketCity } from '@/lib/wizard/market-cities'

export type MarketCitySeoPage = MarketCity & {
  slug: string
  headline: string
  description: string
  intro: string
  keywords: string[]
}

const CITY_SEO: Record<string, Omit<MarketCitySeoPage, keyof MarketCity | 'slug'>> = {
  edmonton: {
    headline: 'Makers markets in Edmonton',
    description:
      'Find upcoming pop-up and makers markets in Edmonton, Alberta — see confirmed vendors, dates, and locations on Popup Hub.',
    intro:
      'Plan your weekend around Edmonton-area artisan markets, craft fairs, and community pop-ups. Popup Hub lists published markets with confirmed vendor counts so you know who is vending before you go.',
    keywords: [
      'Edmonton makers market',
      'Edmonton craft fair',
      'Edmonton pop-up market',
      'farmers market Edmonton',
      'weekend market Edmonton',
    ],
  },
  calgary: {
    headline: 'Makers markets in Calgary',
    description:
      'Discover pop-up and makers markets in Calgary, Alberta — browse dates, locations, and confirmed vendors on Popup Hub.',
    intro:
      'From Calgary community halls to outdoor artisan fairs, Popup Hub helps patrons and vendors find published markets across the Calgary area with vendor lineups you can browse ahead of market day.',
    keywords: [
      'Calgary makers market',
      'Calgary craft fair',
      'Calgary pop-up market',
      'farmers market Calgary',
      'weekend market Calgary',
    ],
  },
}

export const INDEXABLE_MARKET_CITY_SLUGS = ['edmonton', 'calgary'] as const

export type IndexableMarketCitySlug = (typeof INDEXABLE_MARKET_CITY_SLUGS)[number]

export function getMarketCitySeoPage(slug: string): MarketCitySeoPage | null {
  if (!INDEXABLE_MARKET_CITY_SLUGS.includes(slug as IndexableMarketCitySlug)) {
    return null
  }

  const city = getMarketCityById(slug)
  const seo = CITY_SEO[slug]
  if (!seo) return null

  return { ...city, slug, ...seo }
}

export function listMarketCitySeoPages(): MarketCitySeoPage[] {
  return INDEXABLE_MARKET_CITY_SLUGS.map((slug) => getMarketCitySeoPage(slug)).filter(
    (page): page is MarketCitySeoPage => page != null,
  )
}

export function isIndexableMarketCitySlug(slug: string): slug is IndexableMarketCitySlug {
  return INDEXABLE_MARKET_CITY_SLUGS.includes(slug as IndexableMarketCitySlug)
}

/** All configured market cities (for internal tools — not all have SEO landing pages). */
export { MARKET_CITIES }
