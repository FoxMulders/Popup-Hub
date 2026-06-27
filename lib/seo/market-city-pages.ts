import { getMarketCityById, MARKET_CITIES, type MarketCity } from '@/lib/wizard/market-cities'

export type MarketCitySeoPage = MarketCity & {
  slug: string
  headline: string
  description: string
  intro: string
  keywords: string[]
}

function cityName(label: string): string {
  return label.split(',')[0]!.trim()
}

function buildCitySeo(
  slug: string,
  variants: {
    marketNoun?: string
    extraKeywords?: string[]
    intro?: string
  } = {},
): Omit<MarketCitySeoPage, keyof MarketCity | 'slug'> {
  const city = getMarketCityById(slug)
  const name = cityName(city.label)
  const marketNoun = variants.marketNoun ?? 'makers markets'
  const headline = `${marketNoun.charAt(0).toUpperCase() + marketNoun.slice(1)} in ${name}`
  const description = `Find upcoming pop-up and ${marketNoun} in ${name}, Alberta — see confirmed vendors, dates, and locations on Popup Hub.`
  const intro =
    variants.intro ??
    `Plan your weekend around ${name}-area artisan markets, craft fairs, and community pop-ups. Popup Hub lists published markets with confirmed vendor counts so you know who is vending before you go.`

  const keywords = [
    `${name} makers market`,
    `${name} craft fair`,
    `${name} pop-up market`,
    `farmers market ${name}`,
    `weekend market ${name}`,
    ...(variants.extraKeywords ?? []),
  ]

  return { headline, description, intro, keywords }
}

const CITY_SEO: Record<string, Omit<MarketCitySeoPage, keyof MarketCity | 'slug'>> = {
  edmonton: buildCitySeo('edmonton', {
    extraKeywords: ['Edmonton artisan market', 'vendor call Edmonton'],
  }),
  calgary: buildCitySeo('calgary', {
    extraKeywords: ['Calgary night market', 'vendor application Calgary'],
  }),
  'red-deer': buildCitySeo('red-deer'),
  lethbridge: buildCitySeo('lethbridge'),
  'medicine-hat': buildCitySeo('medicine-hat'),
  'grande-prairie': buildCitySeo('grande-prairie'),
  'sherwood-park': buildCitySeo('sherwood-park', {
    intro:
      'Sherwood Park and Strathcona County hosts artisan fairs and community pop-ups throughout the year. Browse published markets with confirmed vendor lineups on Popup Hub.',
  }),
  'st-albert': buildCitySeo('st-albert'),
  airdrie: buildCitySeo('airdrie'),
}

export const INDEXABLE_MARKET_CITY_SLUGS = [
  'edmonton',
  'calgary',
  'red-deer',
  'lethbridge',
  'medicine-hat',
  'grande-prairie',
  'sherwood-park',
  'st-albert',
  'airdrie',
] as const

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

export function getMarketCityShortName(slug: string): string {
  const page = getMarketCitySeoPage(slug)
  return page ? cityName(page.label) : slug
}
