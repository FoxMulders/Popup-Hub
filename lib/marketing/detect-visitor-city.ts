import { headers } from 'next/headers'
import {
  DEFAULT_MARKET_CITY_ID,
  getMarketCityById,
  inferMarketCityId,
} from '@/lib/wizard/market-cities'

const SOUTHERN_ALBERTA_REGION_CODES = new Set(['AB', 'Alberta'])

/** Display name for a hub city slug (e.g. "edmonton" → "Edmonton"). */
export function hubCityDisplayName(slug: string): string {
  return getMarketCityById(slug).label.split(',')[0]!.trim()
}

/**
 * Resolve a detected city string prop, defaulting to Edmonton when null/undefined.
 * Accepts either a display name ("Calgary") or hub slug ("calgary").
 */
export function resolveDetectedCity(city: string | null | undefined): string {
  if (!city?.trim()) {
    return hubCityDisplayName(DEFAULT_MARKET_CITY_ID)
  }

  const trimmed = city.trim()
  const slug = inferMarketCityId(trimmed)
  if (slug !== DEFAULT_MARKET_CITY_ID || trimmed.toLowerCase().includes('edmonton')) {
    return hubCityDisplayName(slug)
  }

  return trimmed
}

function resolveSlugFromGeoHeaders(ipCity: string | null, region: string | null): string {
  if (ipCity?.trim()) {
    return inferMarketCityId(ipCity)
  }

  if (region?.trim()) {
    const normalized = region.trim()
    if (SOUTHERN_ALBERTA_REGION_CODES.has(normalized)) {
      return DEFAULT_MARKET_CITY_ID
    }
  }

  return DEFAULT_MARKET_CITY_ID
}

/**
 * IP-based simulated geo-targeting via Vercel request headers.
 * Falls back to Edmonton when headers are absent (local dev).
 */
export async function detectVisitorCity(): Promise<string> {
  const headerStore = await headers()
  const ipCity = headerStore.get('x-vercel-ip-city')
  const region = headerStore.get('x-vercel-ip-country-region')

  const slug = resolveSlugFromGeoHeaders(ipCity, region)
  return hubCityDisplayName(slug)
}

/** Slug companion for detectVisitorCity — used for search-bar smart routing. */
export async function detectVisitorCitySlug(): Promise<string> {
  const headerStore = await headers()
  const ipCity = headerStore.get('x-vercel-ip-city')
  const region = headerStore.get('x-vercel-ip-country-region')
  return resolveSlugFromGeoHeaders(ipCity, region)
}
