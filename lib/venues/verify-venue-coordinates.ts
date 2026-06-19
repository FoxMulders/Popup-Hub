import { matchEdmontonVenuePreset } from '@/lib/booth-planner/edmonton-venue-registry'
import { isNamedEstablishmentPlace } from '@/lib/wizard/google-place-venue'
import type { VenueVerificationStatus } from '@/types/database'

export interface VenueVerificationInput {
  latitude: number
  longitude: number
  address?: string
  locationName?: string
  pinDropped?: boolean
}

const NAMED_PUBLIC_VENUE_PATTERN =
  /\b(community league|community hall|community centre|community center|recreation centre|recreation center|legion|curling club|fairground|pavilion|arena|event centre|event center|civic centre|civic center|seniors centre|seniors center|expo centre|expo center)\b/i

/** Venue name patterns for public event spaces Google often tags as street addresses only. */
export function isNamedPublicEventSpace(name: string | undefined): boolean {
  const trimmed = name?.trim() ?? ''
  if (trimmed.length < 4) return false
  return NAMED_PUBLIC_VENUE_PATTERN.test(trimmed)
}

export interface VenueVerificationResult {
  verified: boolean
  status: VenueVerificationStatus
  reason: string | null
  placeTypes: string[]
}

const COMMERCIAL_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'premise',
  'shopping_mall',
  'store',
  'food',
  'health',
  'finance',
  'lodging',
])

const PUBLIC_SPACE_TYPES = new Set([
  'park',
  'campground',
  'tourist_attraction',
  'natural_feature',
])

const POLITICAL_TYPES = new Set(['locality', 'political', 'administrative_area_level_1'])

const REJECT_ONLY_TYPES = new Set(['route', 'street_address', 'plus_code', 'postal_code'])

/** Pin dropped with a complete street address — sufficient for markets and quarter auctions. */
export function hasCompleteVenuePin(input: VenueVerificationInput): boolean {
  if (input.pinDropped === false) return false
  return (input.address?.trim().length ?? 0) >= 10
}

function verifiedVenueResult(placeTypes: string[]): VenueVerificationResult {
  return {
    verified: true,
    status: 'verified',
    reason: null,
    placeTypes: placeTypes.length ? placeTypes : ['pin_and_address'],
  }
}

function isInvalidCoordinates(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true
  if (lat === 0 && lng === 0) return true
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return true
  return false
}

function classifyPlaceTypes(types: string[]): {
  verified: boolean
  status: VenueVerificationStatus
  reason: string | null
} {
  if (!types.length) {
    return {
      verified: false,
      status: 'rejected',
      reason: 'No place type returned for these coordinates.',
    }
  }

  const typeSet = new Set(types)
  const hasCommercial = types.some((t) => COMMERCIAL_TYPES.has(t))
  const hasPublicSpace = types.some((t) => PUBLIC_SPACE_TYPES.has(t))
  const hasPolitical = types.some((t) => POLITICAL_TYPES.has(t))
  const onlyRejectTypes = types.every((t) => REJECT_ONLY_TYPES.has(t))

  if (onlyRejectTypes) {
    return {
      verified: false,
      status: 'rejected',
      reason: 'Coordinates point to a street address only — drop a pin on the venue and enter a complete address.',
    }
  }

  if (hasCommercial || isNamedEstablishmentPlace(types)) {
    return { verified: true, status: 'verified', reason: null }
  }

  if (hasPublicSpace && (hasPolitical || typeSet.has('park') || typeSet.has('campground'))) {
    return { verified: true, status: 'verified', reason: null }
  }

  if (hasPublicSpace) {
    return { verified: true, status: 'verified', reason: null }
  }

  return {
    verified: false,
    status: 'rejected',
    reason: 'Could not confirm this location — drop a pin on the venue and enter a complete address.',
  }
}

function pickGeocodeTypesFromResults(
  results: Array<{ types?: string[] }>
): string[] {
  for (const result of results) {
    const types = result.types ?? []
    if (!types.length) continue
    if (classifyPlaceTypes(types).verified) return types
  }
  for (const result of results) {
    const types = result.types ?? []
    if (isNamedEstablishmentPlace(types)) return types
  }
  return results[0]?.types ?? []
}

function evaluateKnownOrNamedVenueFallback(
  input: VenueVerificationInput
): VenueVerificationResult | null {
  if (input.pinDropped === false) return null

  const address = input.address?.trim() ?? ''
  if (address.length < 10) return null

  const locationName = input.locationName?.trim() ?? ''

  if (
    matchEdmontonVenuePreset({
      venueName: locationName,
      address,
      lat: input.latitude,
      lng: input.longitude,
    })
  ) {
    return {
      verified: true,
      status: 'verified',
      reason: null,
      placeTypes: ['known_edmonton_venue'],
    }
  }

  if (locationName && isNamedPublicEventSpace(locationName)) {
    return {
      verified: true,
      status: 'verified',
      reason: null,
      placeTypes: ['named_public_venue'],
    }
  }

  return null
}

export function evaluateVenuePlaceTypes(types: string[]): VenueVerificationResult {
  const classification = classifyPlaceTypes(types)
  return {
    verified: classification.verified,
    status: classification.status,
    reason: classification.reason,
    placeTypes: types,
  }
}

export function evaluateVenueCoordinatesLocally(
  input: VenueVerificationInput
): VenueVerificationResult | null {
  if (isInvalidCoordinates(input.latitude, input.longitude)) {
    return {
      verified: false,
      status: 'rejected',
      reason: 'Drop a map pin on the venue — city-centre defaults are not accepted.',
      placeTypes: [],
    }
  }

  if (input.pinDropped === false) {
    return {
      verified: false,
      status: 'pending',
      reason: 'Drop a map pin on the venue location.',
      placeTypes: [],
    }
  }

  return null
}

interface GeocodeResponse {
  results?: Array<{ types: string[]; formatted_address?: string }>
  status?: string
  error_message?: string
}

export async function verifyVenueCoordinates(
  input: VenueVerificationInput
): Promise<VenueVerificationResult> {
  const local = evaluateVenueCoordinatesLocally(input)
  if (local) return local

  // Server-side Geocoding REST calls must use a key without HTTP referrer restrictions.
  // Browser keys (NEXT_PUBLIC_*) are website-restricted and fail publish-time venue checks.
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()

  if (!apiKey) {
    const fallback = evaluateKnownOrNamedVenueFallback(input)
    if (fallback) return fallback

    const addressLooksValid = (input.address?.trim().length ?? 0) >= 10
    if (addressLooksValid && input.pinDropped !== false) {
      return {
        verified: true,
        status: 'verified',
        reason: null,
        placeTypes: ['manual_fallback'],
      }
    }
    return {
      verified: false,
      status: 'pending',
      reason: 'Maps API unavailable — enter a complete venue address and drop a pin.',
      placeTypes: [],
    }
  }

  const params = new URLSearchParams({
    latlng: `${input.latitude},${input.longitude}`,
    key: apiKey,
  })
  if (input.address?.trim()) {
    params.set('address', input.address.trim())
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  )
  const data = (await res.json()) as GeocodeResponse

  if (data.status !== 'OK' || !data.results?.length) {
    const fallback = evaluateKnownOrNamedVenueFallback(input)
    if (fallback) return fallback

    const googleMessage = data.error_message?.trim()
    const reason =
      googleMessage &&
      /not authorized|referer|referrer|ip.*not authorized/i.test(googleMessage)
        ? 'Venue verification failed: the server Maps API key is missing or uses browser-only website restrictions. In Google Cloud Console, create a separate key with Geocoding API enabled and no website referrer restrictions, then set GOOGLE_MAPS_SERVER_API_KEY on Vercel and redeploy.'
        : (googleMessage ??
          'Could not verify this location. Drop a pin on the venue and enter a complete address.')
    return {
      verified: false,
      status: 'rejected',
      reason,
      placeTypes: [],
    }
  }

  const types = pickGeocodeTypesFromResults(data.results)

  if (hasCompleteVenuePin(input)) {
    return verifiedVenueResult(types)
  }

  const result = evaluateVenuePlaceTypes(types)
  if (result.verified) return result

  const fallback = evaluateKnownOrNamedVenueFallback(input)
  if (fallback) return fallback

  return result
}

export function venueVerificationFieldsFromResult(
  result: VenueVerificationResult,
  now: Date = new Date()
): {
  venue_verified: boolean
  venue_verification_status: VenueVerificationStatus
  venue_verification_reason: string | null
  venue_verified_at: string | null
  venue_place_types: string[]
} {
  return {
    venue_verified: result.verified,
    venue_verification_status: result.status,
    venue_verification_reason: result.reason,
    venue_verified_at: result.verified ? now.toISOString() : null,
    venue_place_types: result.placeTypes,
  }
}
