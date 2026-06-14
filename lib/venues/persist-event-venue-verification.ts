import type { SupabaseClient } from '@supabase/supabase-js'
import {
  venueVerificationFieldsFromResult,
  verifyVenueCoordinates,
} from '@/lib/venues/verify-venue-coordinates'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'
import type { VenueVerificationResult } from '@/lib/venues/verify-venue-coordinates'

export async function resolveEventVenueVerification(input: {
  latitude: number
  longitude: number
  address?: string
  locationName?: string
  pinDropped?: boolean
}): Promise<VenueVerificationResult> {
  return verifyVenueCoordinates({
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address,
    locationName: input.locationName,
    pinDropped: input.pinDropped,
  })
}

export async function persistEventVenueVerification(
  supabase: SupabaseClient,
  eventId: string,
  input: {
    latitude: number
    longitude: number
    address?: string
    locationName?: string
    pinDropped?: boolean
  }
): Promise<VenueVerificationResult> {
  const result = await resolveEventVenueVerification(input)
  const fields = venueVerificationFieldsFromResult(result)
  await supabase.from('events').update(fields).eq('id', eventId)
  return result
}

export async function assertEventVenueVerifiedForPublish(
  supabase: SupabaseClient,
  eventId: string,
  input: {
    latitude: number
    longitude: number
    address?: string
    locationName?: string
    pinDropped?: boolean
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await persistEventVenueVerification(supabase, eventId, input)
  const gate = requireVenueVerified({
    venue_verified: result.verified,
    venue_verification_status: result.status,
    venue_verification_reason: result.reason,
  })
  if (!gate.ok) return gate
  return { ok: true }
}
