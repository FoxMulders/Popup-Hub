import type { SupabaseClient } from '@supabase/supabase-js'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

export async function assertOrganizerReviewResponder(
  reviewId: string,
  userId: string
): Promise<
  | {
      ok: true
      review: {
        id: string
        organizer_id: string
        vendor_id: string
        event_name: string
      }
      organizer: {
        id: string
        slug: string
        display_name: string
      }
    }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()

  if (!canActAsCoordinator(profile) && profile?.is_admin !== true) {
    return { ok: false, status: 403, error: 'Coordinator account required' }
  }

  const { data: review } = await supabase
    .from('organizer_reviews')
    .select('id, organizer_id, vendor_id, event_name, published')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review || !review.published) {
    return { ok: false, status: 404, error: 'Review not found' }
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, slug, display_name, claimed_by, popup_hub_coordinator_id')
    .eq('id', review.organizer_id)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (!organizer) {
    return { ok: false, status: 404, error: 'Organizer not found' }
  }

  const isClaimHolder =
    organizer.claimed_by === userId ||
    organizer.popup_hub_coordinator_id === userId ||
    profile?.is_admin === true

  if (!isClaimHolder) {
    return {
      ok: false,
      status: 403,
      error: 'Claim this organizer profile before responding to reviews',
    }
  }

  return {
    ok: true,
    review: {
      id: review.id,
      organizer_id: review.organizer_id,
      vendor_id: review.vendor_id,
      event_name: review.event_name,
    },
    organizer: {
      id: organizer.id,
      slug: organizer.slug,
      display_name: organizer.display_name,
    },
  }
}

export async function upsertOrganizerReviewResponse(
  service: SupabaseClient,
  params: {
    reviewId: string
    responderId: string
    responseBody: string
  }
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const trimmed = params.responseBody.trim()
  if (trimmed.length < 10) {
    return { ok: false, error: 'Response must be at least 10 characters' }
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: 'Response must be 2000 characters or fewer' }
  }

  const { data: existing } = await service
    .from('organizer_review_responses')
    .select('id')
    .eq('review_id', params.reviewId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload = {
    review_id: params.reviewId,
    responder_id: params.responderId,
    response_body: trimmed,
    updated_at: now,
  }

  if (existing) {
    const { error } = await service
      .from('organizer_review_responses')
      .update(payload)
      .eq('id', existing.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, created: false }
  }

  const { error } = await service.from('organizer_review_responses').insert(payload)
  if (error) return { ok: false, error: error.message }
  return { ok: true, created: true }
}
