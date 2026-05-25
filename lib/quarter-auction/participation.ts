import type { SupabaseClient } from '@supabase/supabase-js'
import { distanceKm } from '@/lib/shopper/geo'

/** Max distance from event pin to count as on-site (metres). */
export const AUCTION_PRESENCE_RADIUS_METERS = 500

export interface EventAuctionParticipant {
  event_id: string
  user_id: string
  participated_at: string
  check_in_lat: number
  check_in_lng: number
  distance_meters: number | null
}

export function isWithinEventPresence(
  userLat: number,
  userLng: number,
  eventLat: number,
  eventLng: number
): { ok: true; distanceMeters: number } | { ok: false; distanceMeters: number } {
  const km = distanceKm({ lat: userLat, lng: userLng }, { lat: eventLat, lng: eventLng })
  const distanceMeters = km * 1000
  if (distanceMeters <= AUCTION_PRESENCE_RADIUS_METERS) {
    return { ok: true, distanceMeters }
  }
  return { ok: false, distanceMeters }
}

export async function getAuctionParticipation(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<EventAuctionParticipant | null> {
  const { data } = await supabase
    .from('event_auction_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  return (data as EventAuctionParticipant | null) ?? null
}

export async function assertAuctionParticipant(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getAuctionParticipation(supabase, eventId, userId)
  if (!row) {
    return {
      ok: false,
      error: 'You must participate at the event before joining the auction.',
      status: 403,
    }
  }
  return { ok: true }
}

export async function registerAuctionParticipation(
  supabase: SupabaseClient,
  input: {
    eventId: string
    userId: string
    lat: number
    lng: number
    eventLat: number
    eventLng: number
  }
): Promise<
  | { ok: true; participant: EventAuctionParticipant; alreadyRegistered: boolean }
  | { ok: false; error: string; status: number; distanceMeters?: number }
> {
  const existing = await getAuctionParticipation(supabase, input.eventId, input.userId)
  if (existing) {
    return { ok: true, participant: existing, alreadyRegistered: true }
  }

  const presence = isWithinEventPresence(input.lat, input.lng, input.eventLat, input.eventLng)
  if (!presence.ok) {
    const distanceLabel =
      presence.distanceMeters >= 1000
        ? `${(presence.distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(presence.distanceMeters)} m`
    return {
      ok: false,
      error: `You must be at the event venue to participate (you appear to be about ${distanceLabel} away).`,
      status: 422,
      distanceMeters: presence.distanceMeters,
    }
  }

  const { data, error } = await supabase
    .from('event_auction_participants')
    .insert({
      event_id: input.eventId,
      user_id: input.userId,
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      distance_meters: presence.distanceMeters,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not register participation', status: 422 }
  }

  return {
    ok: true,
    participant: data as EventAuctionParticipant,
    alreadyRegistered: false,
  }
}

/** Staff desk check-in — skips GPS; coordinator confirms patron is on-site. */
export async function registerStaffAssistedParticipation(
  supabase: SupabaseClient,
  input: {
    eventId: string
    userId: string
    eventLat: number
    eventLng: number
  }
): Promise<
  | { ok: true; participant: EventAuctionParticipant; alreadyRegistered: boolean }
  | { ok: false; error: string; status: number }
> {
  const existing = await getAuctionParticipation(supabase, input.eventId, input.userId)
  if (existing) {
    return { ok: true, participant: existing, alreadyRegistered: true }
  }

  const eventLat = input.eventLat
  const eventLng = input.eventLng

  if (!Number.isFinite(eventLat) || !Number.isFinite(eventLng)) {
    return { ok: false, error: 'Event location is not configured for check-in.', status: 422 }
  }

  const { data, error } = await supabase
    .from('event_auction_participants')
    .insert({
      event_id: input.eventId,
      user_id: input.userId,
      check_in_lat: eventLat,
      check_in_lng: eventLng,
      distance_meters: 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not register participation', status: 422 }
  }

  return {
    ok: true,
    participant: data as EventAuctionParticipant,
    alreadyRegistered: false,
  }
}
