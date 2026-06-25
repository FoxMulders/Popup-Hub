import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { findVenueSubmissionByAddress } from '@/lib/venues/platform-venue-submissions'
import { resolveEventVenueVerification } from '@/lib/venues/persist-event-venue-verification'
import type { VenueVerificationInput } from '@/lib/venues/verify-venue-coordinates'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'
import type { EventDraftPayloadInput } from '@/lib/wizard/wizard-autosave'

export type DraftPublishGateResult = { ok: true } | { ok: false; reason: string }

export function assertDraftCategoryFeesForPublish(
  categoryLimits: CategoryLimit[]
): DraftPublishGateResult {
  if (categoryLimits.length === 0) {
    return {
      ok: false,
      reason: 'Add at least one booth category and state its fee before publishing.',
    }
  }

  const missingFee = categoryLimits.find(
    (cl) => !Number.isFinite(cl.pricePerBooth) || cl.pricePerBooth < 0
  )
  if (missingFee) {
    return {
      ok: false,
      reason: 'Set the market-wide booth fee before publishing. Use $0 for free booths.',
    }
  }

  return { ok: true }
}

export function draftVenueVerificationInput(
  draft: EventDraftPayloadInput
): VenueVerificationInput {
  const address = draft.address?.trim() ?? ''
  const locationName = draft.locationName?.trim() ?? ''
  return {
    latitude: draft.latitude,
    longitude: draft.longitude,
    address,
    locationName,
    pinDropped: address.length >= 10 && locationName.length > 0,
  }
}

export async function assertDraftVenueForPublish(
  supabase: SupabaseClient,
  draft: EventDraftPayloadInput
): Promise<DraftPublishGateResult> {
  const locationName = draft.locationName?.trim() ?? ''
  const address = draft.address?.trim() ?? ''

  if (!locationName || !address) {
    return {
      ok: false,
      reason: 'Drop a map pin on the venue before publishing.',
    }
  }

  const pendingVenue = await findVenueSubmissionByAddress(supabase, locationName, address)
  if (pendingVenue?.status === 'pending') {
    return {
      ok: false,
      reason:
        'This venue is pending admin approval. You can save a draft, but publishing is blocked until approved.',
    }
  }

  const venueResult = await resolveEventVenueVerification(draftVenueVerificationInput(draft))
  const gate = requireVenueVerified({
    venue_verified: venueResult.verified,
    venue_verification_status: venueResult.status,
    venue_verification_reason: venueResult.reason,
  })
  if (!gate.ok) return gate

  return { ok: true }
}
