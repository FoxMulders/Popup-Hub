import { getGoogleMapsServerApiKey } from '@/lib/google-maps/config'
import { isNamedEstablishmentPlace } from '@/lib/wizard/google-place-venue'
import type { VenueVerificationStatus } from '@/types/database'

export interface VenueVerificationInput {
  latitude: number
  longitude: number
  address?: string
  pinDropped?: boolean
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
      reason: 'Coordinates point to a street address only — select a commercial venue, park, or public space.',
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
    reason: 'Location must be a commercial property, park, or public event space.',
  }
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

  const apiKey = getGoogleMapsServerApiKey()

  if (!apiKey) {
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
    return {
      verified: false,
      status: 'rejected',
      reason:
        data.error_message ??
        'Could not verify this location. Choose a named venue, park, or public space.',
      placeTypes: [],
    }
  }

  const best = data.results[0]!
  return evaluateVenuePlaceTypes(best.types ?? [])
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
