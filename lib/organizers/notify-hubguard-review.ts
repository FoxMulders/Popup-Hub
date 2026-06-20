import type { SupabaseClient } from '@supabase/supabase-js'

type OrganizerRow = {
  id: string
  slug: string
  display_name: string
  claimed_by: string | null
  popup_hub_coordinator_id: string | null
}

function organizerCoordinatorId(organizer: OrganizerRow): string | null {
  return organizer.claimed_by ?? organizer.popup_hub_coordinator_id
}

/** Alert the linked coordinator when a vendor HubGuard review is published. */
export async function notifyOrganizerOfVendorReview(
  supabase: SupabaseClient,
  params: {
    reviewId: string
    organizer: OrganizerRow
    eventName: string
    vendorName: string | null
  }
): Promise<void> {
  const coordinatorId = organizerCoordinatorId(params.organizer)
  if (!coordinatorId) return

  const vendorLabel = params.vendorName?.trim() || 'A vendor'
  const message = `${vendorLabel} left a HubGuard review for ${params.eventName}. You can add your perspective on your trust report.`

  await supabase.from('notifications').insert({
    user_id: coordinatorId,
    type: 'hubguard_vendor_review',
    message,
    metadata: {
      review_id: params.reviewId,
      organizer_id: params.organizer.id,
      organizer_slug: params.organizer.slug,
      event_name: params.eventName,
      deep_link: `/organizers/${params.organizer.slug}#vendor-reviews`,
    },
  })
}

/** Alert the vendor when an organizer responds to their HubGuard review. */
export async function notifyVendorOfReviewResponse(
  supabase: SupabaseClient,
  params: {
    reviewId: string
    vendorId: string
    organizerName: string
    eventName: string
    organizerSlug: string
  }
): Promise<void> {
  const message = `${params.organizerName} responded to your review of ${params.eventName}.`

  await supabase.from('notifications').insert({
    user_id: params.vendorId,
    type: 'hubguard_review_response',
    message,
    metadata: {
      review_id: params.reviewId,
      organizer_slug: params.organizerSlug,
      event_name: params.eventName,
      deep_link: `/organizers/${params.organizerSlug}#vendor-reviews`,
    },
  })
}
