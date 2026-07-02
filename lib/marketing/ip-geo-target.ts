import { headers } from 'next/headers'
import { getMarketCityById, MARKET_CITIES } from '@/lib/wizard/market-cities'

const FEATURED_HUB_CITY_NAMES = ['Edmonton', 'Calgary'] as const
export type FeaturedHubCityName = (typeof FEATURED_HUB_CITY_NAMES)[number]

const FEATURED_HUB_CITY_IDS = ['edmonton', 'calgary'] as const

function cityShortName(label: string): string {
  return label.split(',')[0]!.trim()
}

function matchMarketCityName(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return null

  for (const city of MARKET_CITIES) {
    const name = cityShortName(city.label).toLowerCase()
    if (normalized === name || normalized.startsWith(`${name},`)) {
      return cityShortName(city.label)
    }
  }
  return null
}

function simulatedFallbackCity(ipSeed: string): FeaturedHubCityName {
  const hash = [...ipSeed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return FEATURED_HUB_CITY_NAMES[hash % FEATURED_HUB_CITY_NAMES.length]!
}

/**
 * IP-based geo-targeting for the homepage location discovery section.
 * Uses Vercel geo headers when present; otherwise simulates Edmonton/Calgary.
 */
export async function detectCityFromRequest(): Promise<string> {
  const headerStore = await headers()
  const vercelCity = headerStore.get('x-vercel-ip-city')
  const vercelCountry = headerStore.get('x-vercel-ip-country')

  if (vercelCountry === 'CA' && vercelCity) {
    const matched = matchMarketCityName(vercelCity)
    if (matched) return matched
  }

  const ipSeed =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    'popup-hub-default'

  return simulatedFallbackCity(ipSeed)
}

export function resolveDetectedCity(detectedCity: string | null | undefined): string {
  if (detectedCity?.trim()) {
    const matched = matchMarketCityName(detectedCity)
    if (matched) return matched
    return detectedCity.trim()
  }

  return getMarketCityById(FEATURED_HUB_CITY_IDS[0]).label.split(',')[0]!.trim()
}
