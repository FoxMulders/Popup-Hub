import type { SupabaseClient } from '@supabase/supabase-js'
import { matchEdmontonVenuePreset } from '@/lib/booth-planner/edmonton-venue-registry'

export type VenueSubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface VenueSubmissionInput {
  locationName: string
  address: string
  latitude: number
  longitude: number
  marketCity?: string | null
}

function normalizeKey(locationName: string, address: string) {
  return {
    locationName: locationName.trim(),
    address: address.trim(),
  }
}

export async function findVenueSubmissionByAddress(
  supabase: SupabaseClient,
  locationName: string,
  address: string
): Promise<{ status: VenueSubmissionStatus } | null> {
  const key = normalizeKey(locationName, address)
  if (!key.locationName || !key.address) return null

  const { data } = await supabase
    .from('platform_venue_submissions')
    .select('status')
    .ilike('location_name', key.locationName)
    .ilike('address', key.address)
    .in('status', ['pending', 'approved'])
    .maybeSingle()

  return data ? { status: data.status as VenueSubmissionStatus } : null
}

export async function submitPlatformVenue(
  supabase: SupabaseClient,
  coordinatorId: string,
  input: VenueSubmissionInput
): Promise<{ error: Error | null; created: boolean }> {
  const key = normalizeKey(input.locationName, input.address)
  if (!key.locationName || !key.address) {
    return { error: new Error('Venue name and address are required'), created: false }
  }

  const existing = await findVenueSubmissionByAddress(supabase, key.locationName, key.address)
  if (existing?.status === 'approved') {
    return { error: null, created: false }
  }
  if (existing?.status === 'pending') {
    return { error: null, created: false }
  }

  const { error } = await supabase.from('platform_venue_submissions').insert({
    submitted_by: coordinatorId,
    location_name: key.locationName,
    address: key.address,
    latitude: input.latitude,
    longitude: input.longitude,
    market_city: input.marketCity ?? null,
    status: 'pending',
  })

  if (error) {
    if (error.code === '23505') return { error: null, created: false }
    return { error: new Error(error.message), created: false }
  }
  return { error: null, created: true }
}

export function isCommunityLeagueVenueName(locationName: string): boolean {
  return /\bcommunity league\b/i.test(locationName.trim())
}

/** True when a coordinator-entered venue should enter the admin review queue. */
export async function shouldSubmitPlatformVenue(
  supabase: SupabaseClient,
  coordinatorId: string,
  input: VenueSubmissionInput
): Promise<boolean> {
  const key = normalizeKey(input.locationName, input.address)
  if (!key.locationName || !key.address) return false

  if (
    matchEdmontonVenuePreset({
      venueName: key.locationName,
      address: key.address,
      lat: input.latitude,
      lng: input.longitude,
    })
  ) {
    return false
  }

  const existing = await findVenueSubmissionByAddress(supabase, key.locationName, key.address)
  if (existing?.status === 'approved' || existing?.status === 'pending') {
    return false
  }

  const { data: savedVenue } = await supabase
    .from('coordinator_saved_venues')
    .select('id')
    .eq('coordinator_id', coordinatorId)
    .ilike('location_name', key.locationName)
    .ilike('address', key.address)
    .maybeSingle()

  return !savedVenue
}
