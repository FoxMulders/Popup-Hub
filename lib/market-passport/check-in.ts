import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWithinEventPresence,
  type EventAuctionParticipant,
} from '@/lib/quarter-auction/participation'
import type { MarketPatronCheckIn } from '@/types/database'

export const DEFAULT_PASSPORT_VENDORS_REQUIRED = 5

export function resolvePassportVendorsRequired(
  configured: number | null | undefined
): number {
  if (typeof configured === 'number' && configured >= 1) {
    return Math.min(configured, 100)
  }
  return DEFAULT_PASSPORT_VENDORS_REQUIRED
}

export async function getMarketPatronCheckIn(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<MarketPatronCheckIn | null> {
  const { data } = await supabase
    .from('market_patron_check_ins')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  return (data as MarketPatronCheckIn | null) ?? null
}

async function nextPaddleNumber(
  supabase: SupabaseClient,
  eventId: string
): Promise<number> {
  const { data } = await supabase
    .from('market_patron_check_ins')
    .select('paddle_number')
    .eq('event_id', eventId)
    .order('paddle_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return ((data as { paddle_number?: number } | null)?.paddle_number ?? 0) + 1
}

export async function registerMarketPatronCheckIn(
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
  | { ok: true; checkIn: MarketPatronCheckIn; alreadyCheckedIn: boolean }
  | { ok: false; error: string; status: number; distanceMeters?: number }
> {
  const existing = await getMarketPatronCheckIn(supabase, input.eventId, input.userId)
  if (existing) {
    return { ok: true, checkIn: existing, alreadyCheckedIn: true }
  }

  const presence = isWithinEventPresence(
    input.lat,
    input.lng,
    input.eventLat,
    input.eventLng
  )
  if (!presence.ok) {
    const distanceLabel =
      presence.distanceMeters >= 1000
        ? `${(presence.distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(presence.distanceMeters)} m`
    return {
      ok: false,
      error: `You must be at the market to check in (you appear to be about ${distanceLabel} away).`,
      status: 422,
      distanceMeters: presence.distanceMeters,
    }
  }

  const paddleNumber = await nextPaddleNumber(supabase, input.eventId)

  const { data, error } = await supabase
    .from('market_patron_check_ins')
    .insert({
      event_id: input.eventId,
      user_id: input.userId,
      paddle_number: paddleNumber,
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      distance_meters: presence.distanceMeters,
    })
    .select('*')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Could not complete check-in',
      status: 422,
    }
  }

  return {
    ok: true,
    checkIn: data as MarketPatronCheckIn,
    alreadyCheckedIn: false,
  }
}

/** Re-export for type compatibility with auction participation rows. */
export type { EventAuctionParticipant }
