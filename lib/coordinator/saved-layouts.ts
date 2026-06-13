import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoordinatorSavedLayout, LayoutRoom } from '@/types/database'
import {
  normalizeSavedLayoutVenueKey,
  sanitizeLayoutRoomsForTemplate,
} from '@/lib/coordinator/saved-layout-snapshot'

export interface SavedLayoutVenue {
  locationName: string
  address: string
}

export interface SavedLayoutInput {
  name: string
  venue: SavedLayoutVenue
  layoutRooms: LayoutRoom[]
  activeRoomId: string | null
  isPublic: boolean
}

function trim(value: string): string {
  return value.trim()
}

export async function listCoordinatorSavedLayouts(
  supabase: SupabaseClient,
  coordinatorId: string,
  venue: SavedLayoutVenue
): Promise<{ layouts: CoordinatorSavedLayout[]; error: Error | null }> {
  const key = normalizeSavedLayoutVenueKey(venue.locationName, venue.address)
  if (!key.locationName || !key.address) {
    return { layouts: [], error: null }
  }

  const { data, error } = await supabase
    .from('coordinator_saved_layouts')
    .select('*')
    .eq('location_name', key.locationName)
    .eq('address', key.address)
    .or(`coordinator_id.eq.${coordinatorId},is_public.eq.true`)
    .order('last_used_at', { ascending: false })

  if (error) return { layouts: [], error: new Error(error.message) }
  return { layouts: (data ?? []) as CoordinatorSavedLayout[], error: null }
}

export async function saveCoordinatorLayout(
  supabase: SupabaseClient,
  coordinatorId: string,
  input: SavedLayoutInput
): Promise<{ layout: CoordinatorSavedLayout | null; error: Error | null }> {
  const name = trim(input.name)
  const key = normalizeSavedLayoutVenueKey(input.venue.locationName, input.venue.address)

  if (!name) {
    return { layout: null, error: new Error('Layout name is required') }
  }
  if (!key.locationName || !key.address) {
    return {
      layout: null,
      error: new Error('Venue name and address are required before saving a layout'),
    }
  }
  if (input.layoutRooms.length === 0) {
    return { layout: null, error: new Error('Add at least one room before saving a layout') }
  }

  const row = {
    coordinator_id: coordinatorId,
    name,
    location_name: key.locationName,
    address: key.address,
    layout_rooms: sanitizeLayoutRoomsForTemplate(input.layoutRooms),
    active_room_id: input.activeRoomId,
    is_public: input.isPublic,
    last_used_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('coordinator_saved_layouts')
    .upsert(row, { onConflict: 'coordinator_id,location_name,address,name' })
    .select('*')
    .single()

  if (error) return { layout: null, error: new Error(error.message) }
  return { layout: data as CoordinatorSavedLayout, error: null }
}

export async function touchCoordinatorSavedLayout(
  supabase: SupabaseClient,
  layoutId: string
): Promise<void> {
  await supabase
    .from('coordinator_saved_layouts')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', layoutId)
}

export async function deleteCoordinatorSavedLayout(
  supabase: SupabaseClient,
  layoutId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('coordinator_saved_layouts').delete().eq('id', layoutId)
  return { error: error ? new Error(error.message) : null }
}
