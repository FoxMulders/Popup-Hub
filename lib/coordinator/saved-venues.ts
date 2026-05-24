import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoordinatorSavedVenue } from '@/types/database'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'

export interface SavedVenueInput {
  locationName: string
  address: string
  latitude: number
  longitude: number
  venuePresetId: VenuePresetId
  skipVenueLayout: boolean
  marketCity: string
}

function trim(value: string): string {
  return value.trim()
}

export async function listCoordinatorSavedVenues(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ venues: CoordinatorSavedVenue[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('coordinator_saved_venues')
    .select('*')
    .eq('coordinator_id', coordinatorId)
    .order('last_used_at', { ascending: false })

  if (error) return { venues: [], error: new Error(error.message) }
  return { venues: (data ?? []) as CoordinatorSavedVenue[], error: null }
}

export async function saveCoordinatorVenue(
  supabase: SupabaseClient,
  coordinatorId: string,
  input: SavedVenueInput
): Promise<{ venue: CoordinatorSavedVenue | null; error: Error | null }> {
  const locationName = trim(input.locationName)
  const address = trim(input.address)

  if (!locationName || !address) {
    return { venue: null, error: new Error('Venue name and address are required') }
  }

  const row = {
    coordinator_id: coordinatorId,
    location_name: locationName,
    address,
    latitude: input.latitude,
    longitude: input.longitude,
    venue_preset_id: input.venuePresetId === 'blank' ? null : input.venuePresetId,
    skip_venue_layout: input.skipVenueLayout,
    market_city: input.marketCity,
    last_used_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('coordinator_saved_venues')
    .upsert(row, { onConflict: 'coordinator_id,location_name,address' })
    .select('*')
    .single()

  if (error) return { venue: null, error: new Error(error.message) }
  return { venue: data as CoordinatorSavedVenue, error: null }
}

export async function touchCoordinatorSavedVenue(
  supabase: SupabaseClient,
  venueId: string
): Promise<void> {
  await supabase
    .from('coordinator_saved_venues')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', venueId)
}

export async function deleteCoordinatorSavedVenue(
  supabase: SupabaseClient,
  venueId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('coordinator_saved_venues').delete().eq('id', venueId)
  return { error: error ? new Error(error.message) : null }
}
