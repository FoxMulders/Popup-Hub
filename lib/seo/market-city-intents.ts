import type { MarketCitySeoPage } from '@/lib/seo/market-city-pages'
import { getMarketCityShortName } from '@/lib/seo/market-city-pages'

export type MarketCityIntentSlug = 'vendor-applications' | 'this-weekend' | 'artisan-markets'

export type MarketCityIntentPage = {
  slug: MarketCityIntentSlug
  headline: string
  description: string
  intro: string
  keywords: string[]
  discoverWhen?: 'weekend' | 'this_month'
  vendorFocus?: boolean
}

function intentPagesForCity(city: MarketCitySeoPage): MarketCityIntentPage[] {
  const name = getMarketCityShortName(city.slug)

  return [
    {
      slug: 'vendor-applications',
      headline: `Vendor applications in ${name}`,
      description: `Find open and juried vendor applications for markets published on Popup Hub in ${name}, Alberta — apply with one passport and verify organizers with HubGuard.`,
      intro: `Skip the Instagram DMs and duplicate PDFs. Browse Popup Hub markets accepting vendor applications near ${name}, check organizer trust reports, and apply with your vendor passport.`,
      keywords: [
        `${name} vendor application`,
        `apply craft fair ${name}`,
        `artisan market vendor ${name}`,
        `booth application ${name}`,
        'craft fair vendor application Alberta',
      ],
      vendorFocus: true,
    },
    {
      slug: 'this-weekend',
      headline: `Markets this weekend in ${name}`,
      description: `See pop-up and makers markets published on Popup Hub happening this weekend in ${name}, Alberta — confirmed vendor counts and booth maps before you visit.`,
      intro: `Plan your Saturday or Sunday around Popup Hub markets near ${name}. See who is vending, browse the lineup, and open the patron map before you leave home.`,
      keywords: [
        `markets this weekend ${name}`,
        `weekend craft fair ${name}`,
        `Saturday market ${name}`,
        `Sunday makers market ${name}`,
      ],
      discoverWhen: 'weekend',
    },
    {
      slug: 'artisan-markets',
      headline: `Artisan markets in ${name}`,
      description: `Discover handmade and artisan markets published on Popup Hub in ${name}, Alberta — meet local makers, browse vendor lineups, and plan your market day.`,
      intro: `From juried craft fairs to recurring community pop-ups, browse artisan markets hosted on Popup Hub across the ${name} area — with maker profiles and confirmed vendor counts.`,
      keywords: [
        `artisan market ${name}`,
        `handmade market ${name}`,
        `local makers ${name}`,
        `craft market ${name}`,
      ],
    },
  ]
}

export const MARKET_CITY_INTENT_SLUGS: MarketCityIntentSlug[] = [
  'vendor-applications',
  'this-weekend',
  'artisan-markets',
]

export function getMarketCityIntentPage(
  city: MarketCitySeoPage,
  intentSlug: string,
): MarketCityIntentPage | null {
  return intentPagesForCity(city).find((page) => page.slug === intentSlug) ?? null
}

export function listMarketCityIntentPages(city: MarketCitySeoPage): MarketCityIntentPage[] {
  return intentPagesForCity(city)
}

export function isMarketCityIntentSlug(slug: string): slug is MarketCityIntentSlug {
  return MARKET_CITY_INTENT_SLUGS.includes(slug as MarketCityIntentSlug)
}

export function buildMarketCityIntentPath(citySlug: string, intentSlug: MarketCityIntentSlug): string {
  return `/markets/${citySlug}/${intentSlug}`
}
