import type { SupabaseClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '@/lib/organizers/slug'
import type {
  OrganizerReviewFields,
  OrganizerReviewPayload,
  OrganizerSuggestPayload,
} from '@/lib/organizers/validate-review-payload'

const MAX_NOMINATIONS_PER_WEEK = 5

export type SubmitOrganizerReviewResult =
  | {
      ok: true
      status: 'published'
      reviewId: string
      organizerSlug: string
      organizerName: string
    }
  | {
      ok: true
      status: 'pending_moderation'
      reviewId: string
      organizerSlug: string
      organizerName: string
    }
  | { ok: false; status: number; error: string; code?: string }

function reviewInsertFields(
  payload: OrganizerReviewFields,
  organizerId: string,
  vendorId: string,
  published: boolean
) {
  return {
    organizer_id: organizerId,
    vendor_id: vendorId,
    event_name: payload.eventName,
    event_month_year: payload.eventMonthYear,
    event_as_advertised: payload.eventAsAdvertised,
    would_return: payload.wouldReturn,
    attendance_vs_expectations: payload.attendanceVsExpectations,
    communication_rating: payload.communicationRating,
    refund_experience: payload.refundExperience,
    optional_notes: payload.optionalNotes ?? null,
    verification_tier: 'unverified' as const,
    published,
  }
}

async function assertNominationRateLimit(
  supabase: SupabaseClient,
  vendorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('organizers')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', vendorId)
    .eq('source', 'vendor_submitted')
    .gte('submitted_at', weekAgo)

  if (error) {
    return { ok: false, error: 'Could not verify submission limit' }
  }

  if ((count ?? 0) >= MAX_NOMINATIONS_PER_WEEK) {
    return {
      ok: false,
      error: 'You can suggest up to 5 new organizers per week. Try again later or pick from the list.',
    }
  }

  return { ok: true }
}

export async function submitOrganizerReview(
  supabase: SupabaseClient,
  vendorId: string,
  payload: OrganizerReviewPayload
): Promise<SubmitOrganizerReviewResult> {
  if (payload.mode === 'existing') {
    const { data: organizer } = await supabase
      .from('organizers')
      .select('id, slug, display_name')
      .eq('slug', payload.organizerSlug)
      .eq('listing_status', 'published')
      .maybeSingle()

    if (!organizer) {
      return { ok: false, status: 404, error: 'Organizer not found' }
    }

    const { data: review, error } = await supabase
      .from('organizer_reviews')
      .insert(reviewInsertFields(payload, organizer.id, vendorId, true))
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return {
          ok: false,
          status: 409,
          error: 'You already reviewed this organizer for that event and month.',
          code: 'duplicate',
        }
      }
      return { ok: false, status: 500, error: error.message }
    }

    return {
      ok: true,
      status: 'published',
      reviewId: review.id,
      organizerSlug: organizer.slug,
      organizerName: organizer.display_name,
    }
  }

  const suggest = payload.suggestOrganizer
  const slug = organizerSlugFromName(suggest.displayName)

  const rateLimit = await assertNominationRateLimit(supabase, vendorId)
  if (!rateLimit.ok) {
    return { ok: false, status: 429, error: rateLimit.error, code: 'rate_limit' }
  }

  const { data: existing } = await supabase
    .from('organizers')
    .select('id, slug, display_name, listing_status')
    .eq('slug', slug)
    .maybeSingle()

  if (existing?.listing_status === 'published') {
    return {
      ok: false,
      status: 409,
      error: `${existing.display_name} is already listed — select them from the dropdown instead.`,
      code: 'already_published',
    }
  }

  if (existing?.listing_status === 'archived') {
    return {
      ok: false,
      status: 409,
      error:
        'We are verifying this organizer name. Contact support if you need to review them before they appear in search.',
      code: 'archived',
    }
  }

  const now = new Date().toISOString()
  const organizerPayload = {
    slug,
    display_name: suggest.displayName,
    primary_contact_name: suggest.contactName ?? null,
    city: suggest.city,
    province: 'AB',
    region: 'edmonton-metro',
    website_url: suggest.websiteUrl ?? null,
    facebook_url: suggest.facebookUrl ?? null,
    listing_status: 'draft' as const,
    source: 'vendor_submitted' as const,
    submitted_by: vendorId,
    submitted_at: now,
    updated_at: now,
  }

  let organizerId = existing?.id

  if (organizerId) {
    const { error: updateError } = await supabase
      .from('organizers')
      .update(organizerPayload)
      .eq('id', organizerId)

    if (updateError) {
      return { ok: false, status: 500, error: updateError.message }
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('organizers')
      .insert(organizerPayload)
      .select('id')
      .single()

    if (insertError) {
      return { ok: false, status: 500, error: insertError.message }
    }
    organizerId = created.id
  }

  const { data: review, error: reviewError } = await supabase
    .from('organizer_reviews')
    .insert(reviewInsertFields(payload, organizerId!, vendorId, false))
    .select('id')
    .single()

  if (reviewError) {
    if (reviewError.code === '23505') {
      return {
        ok: false,
        status: 409,
        error: 'You already submitted a review for this organizer, event, and month.',
        code: 'duplicate',
      }
    }
    return { ok: false, status: 500, error: reviewError.message }
  }

  return {
    ok: true,
    status: 'pending_moderation',
    reviewId: review.id,
    organizerSlug: slug,
    organizerName: suggest.displayName,
  }
}

export type { OrganizerSuggestPayload }
