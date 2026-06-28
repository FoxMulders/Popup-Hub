import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'
import { assertEventVenueVerifiedForPublish } from '@/lib/venues/persist-event-venue-verification'
import { onMarketPublished } from '@/lib/organizers/on-market-published'
import { dispatchPublishMarketAlerts } from '@/lib/vendor/dispatch-publish-market-alerts'
import { dispatchCoordinatorFollowerAlerts } from '@/lib/shopper/dispatch-coordinator-follower-alerts'

export type PublishEventResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

export type PublishCoordinatorEventOptions = {
  /** Skip coordinator fraud gate — only for admin publish-assist approval. */
  bypassVerificationGate?: boolean
  assistRequestId?: string
  reviewerId?: string
}

type PublishableEvent = {
  id: string
  status: string
  coordinator_id: string
  latitude: number
  longitude: number
  address: string
  venue_verified: boolean | null
  venue_verification_status: string | null
}

/** Publish a draft market using the event owner's verification profile. */
export async function publishCoordinatorEvent(
  supabase: SupabaseClient,
  service: SupabaseClient,
  event: PublishableEvent,
  options?: PublishCoordinatorEventOptions
): Promise<PublishEventResult> {
  if (event.status !== 'draft') {
    return { ok: false, error: 'Only draft markets can be published.', status: 409 }
  }

  const bypassVerificationGate = options?.bypassVerificationGate === true

  if (!bypassVerificationGate) {
    const { data: ownerProfile, error: ownerError } = await supabase
      .from('profiles')
      .select(COORDINATOR_FRAUD_PROFILE_SELECT)
      .eq('id', event.coordinator_id)
      .single()

    if (ownerError || !ownerProfile) {
      return { ok: false, error: 'Organizer profile not found.', status: 404 }
    }

    const { data: squareEvent } = await supabase
      .from('events')
      .select('id')
      .eq('coordinator_id', event.coordinator_id)
      .not('square_merchant_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const publishBlock = coordinatorPublishBlockReason({
      ...ownerProfile,
      has_square_event: !!squareEvent,
    })
    if (publishBlock) {
      return { ok: false, error: publishBlock, status: 403 }
    }
  }

  if (!event.venue_verified && event.venue_verification_status !== 'manual_override') {
    const venueGate = await assertEventVenueVerifiedForPublish(supabase, event.id, {
      latitude: event.latitude,
      longitude: event.longitude,
      address: event.address,
      pinDropped: true,
    })
    if (!venueGate.ok) {
      return { ok: false, error: venueGate.reason, status: 400 }
    }
  }

  const { data: limits, error: limitsError } = await supabase
    .from('event_category_limits')
    .select('price_per_booth, category:categories(name)')
    .eq('event_id', event.id)

  if (limitsError) {
    return { ok: false, error: 'Could not verify booth fees before publishing.', status: 500 }
  }

  type FeeRow = {
    price_per_booth: number | null
    category: { name?: string | null } | { name?: string | null }[] | null
  }

  const rows = (limits ?? []) as FeeRow[]
  if (rows.length === 0) {
    return {
      ok: false,
      error: 'Add at least one booth category and state its fee before publishing.',
      status: 400,
    }
  }

  const missing = rows.find(
    (row) =>
      row.price_per_booth === null ||
      row.price_per_booth === undefined ||
      !Number.isFinite(row.price_per_booth) ||
      row.price_per_booth < 0
  )
  if (missing) {
    return {
      ok: false,
      error: 'Set the market-wide booth fee before publishing. Use $0 for free booths.',
      status: 400,
    }
  }

  if (bypassVerificationGate) {
    const assistRequestId = options?.assistRequestId?.trim()
    const reviewerId = options?.reviewerId?.trim()
    if (!assistRequestId || !reviewerId) {
      return {
        ok: false,
        error: 'Publish assist approval requires request and reviewer identifiers.',
        status: 500,
      }
    }

    const { error: rpcError } = await service.rpc('admin_publish_assisted_event', {
      p_request_id: assistRequestId,
      p_reviewer_id: reviewerId,
    })

    if (rpcError) {
      return { ok: false, error: rpcError.message, status: 500 }
    }
  } else {
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: 'published' })
      .eq('id', event.id)

    if (updateError) {
      return { ok: false, error: updateError.message, status: 500 }
    }
  }

  void dispatchPublishMarketAlerts(service, event.id).catch((err) => {
    console.error('[publish] nearby vendor alerts failed', err)
  })
  void dispatchCoordinatorFollowerAlerts(service, event.id).catch((err) => {
    console.error('[publish] coordinator follower alerts failed', err)
  })
  void onMarketPublished(service, event.id).catch((err) => {
    console.error('[publish] trust directory sync failed', err)
  })

  return { ok: true }
}
