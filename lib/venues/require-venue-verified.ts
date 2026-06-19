import type { Event } from '@/types/database'

type VenueGateEvent = Pick<
  Event,
  'venue_verified' | 'venue_verification_status' | 'venue_verification_reason'
>

export function requireVenueVerified(event: VenueGateEvent): { ok: true } | { ok: false; reason: string } {
  if (event.venue_verified === true || event.venue_verification_status === 'verified') {
    return { ok: true }
  }

  if (event.venue_verification_status === 'manual_override') {
    return { ok: true }
  }

  return {
    ok: false,
    reason:
      event.venue_verification_reason?.trim() ||
      'Venue location must be verified before this action. Drop a pin on the venue and enter a complete address.',
  }
}

export const VENUE_VERIFICATION_BLOCK_MESSAGE =
  'Venue location must be verified before publishing or processing booth payments.'
