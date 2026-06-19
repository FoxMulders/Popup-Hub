import { createClient } from '@/lib/supabase/server'
import type {
  CommunityMention,
  Organizer,
  OrganizerEvent,
  OrganizerReviewPublic,
  OrganizerScamAlert,
  ScamWatchlistEntry,
} from '@/types/organizers'

const ORGANIZER_COLUMNS =
  'id, slug, display_name, primary_contact_name, city, province, region, website_url, facebook_url, instagram_handle, typical_season_or_dates, listing_status, source, admin_notes, claimed_by, claimed_at, popup_hub_coordinator_id'

function logOrganizerQueryError(context: string, error: { message: string }) {
  console.error(`[organizers] ${context}:`, error.message)
}

export async function searchPublishedOrganizers(query: string, region = 'edmonton-metro') {
  const supabase = await createClient()
  const trimmed = query.trim()

  let builder = supabase
    .from('organizers')
    .select(ORGANIZER_COLUMNS)
    .eq('listing_status', 'published')
    .eq('region', region)
    .order('display_name')

  if (trimmed.length > 0) {
    builder = builder.or(
      `display_name.ilike.%${trimmed}%,city.ilike.%${trimmed}%,primary_contact_name.ilike.%${trimmed}%`
    )
  }

  const { data, error } = await builder.limit(50)
  if (error) {
    logOrganizerQueryError('searchPublishedOrganizers', error)
    return []
  }
  return (data ?? []) as Organizer[]
}

export async function listPublishedOrganizers(region = 'edmonton-metro') {
  return searchPublishedOrganizers('', region)
}

export async function getPublishedOrganizerBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizers')
    .select(ORGANIZER_COLUMNS)
    .eq('slug', slug)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (error) {
    logOrganizerQueryError('getPublishedOrganizerBySlug', error)
    return null
  }
  return data as Organizer | null
}

export async function getPublishedOrganizerEvents(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, name, city, typical_dates, booth_fee_cad, source_snippet, listing_status')
    .eq('organizer_id', organizerId)
    .eq('listing_status', 'published')
    .order('name')

  if (error) {
    logOrganizerQueryError('getPublishedOrganizerEvents', error)
    return []
  }
  return (data ?? []) as OrganizerEvent[]
}

export async function getPublishedScamAlerts(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_scam_alerts')
    .select('id, organizer_id, alert_title, alert_body, verification_status, source_permalink, published')
    .eq('organizer_id', organizerId)
    .eq('published', true)

  if (error) {
    logOrganizerQueryError('getPublishedScamAlerts', error)
    return []
  }
  return (data ?? []) as OrganizerScamAlert[]
}

export async function getPublishedCommunityMentions(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_community_mentions')
    .select(
      'id, quote, sentiment, mention_type, coordinator_person_name, verification_status, source_permalink, source_snippet, responds_to_mention_id, display_order'
    )
    .eq('organizer_id', organizerId)
    .eq('published', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    logOrganizerQueryError('getPublishedCommunityMentions', error)
    return []
  }

  const mentionIds = (data ?? []).map((m) => m.id)
  const responsesByMention = new Map<string, string>()

  if (mentionIds.length > 0) {
    const { data: responses } = await supabase
      .from('organizer_mention_responses')
      .select('mention_id, response_body')
      .in('mention_id', mentionIds)

    for (const row of responses ?? []) {
      responsesByMention.set(row.mention_id, row.response_body)
    }
  }

  return (data ?? []).map(
    (m) =>
      ({
        ...m,
        response_body: responsesByMention.get(m.id) ?? null,
      }) as CommunityMention
  )
}

export async function getPublishedOrganizerReviews(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_reviews')
    .select(
      `
      id,
      organizer_id,
      vendor_id,
      event_name,
      event_month_year,
      event_as_advertised,
      would_return,
      attendance_vs_expectations,
      communication_rating,
      refund_experience,
      optional_notes,
      verification_tier,
      published,
      created_at,
      profiles:vendor_id ( full_name )
    `
    )
    .eq('organizer_id', organizerId)
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    logOrganizerQueryError('getPublishedOrganizerReviews', error)
    return []
  }

  const reviewIds = (data ?? []).map((r) => r.id)
  const responsesByReview = new Map<string, { body: string; created_at: string }>()

  if (reviewIds.length > 0) {
    const { data: responses } = await supabase
      .from('organizer_review_responses')
      .select('review_id, response_body, created_at')
      .in('review_id', reviewIds)

    for (const row of responses ?? []) {
      responsesByReview.set(row.review_id, {
        body: row.response_body,
        created_at: row.created_at,
      })
    }
  }

  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name?: string } | null
    const { profiles: _profiles, ...review } = row
    const response = responsesByReview.get(review.id)
    return {
      ...review,
      vendor_display_name: profile?.full_name ?? null,
      response_body: response?.body ?? null,
      response_created_at: response?.created_at ?? null,
    } as OrganizerReviewPublic
  })
}

export async function listPublishedScamWatchlist() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scam_watchlist')
    .select(
      'id, slug, display_name, warning_title, warning_body, verification_status, published'
    )
    .eq('published', true)
    .order('display_name')

  if (error) {
    logOrganizerQueryError('listPublishedScamWatchlist', error)
    return []
  }
  return (data ?? []) as ScamWatchlistEntry[]
}

export async function getCoordinatorPlatformReliability(coordinatorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, reliability_score, coordinator_is_verified')
    .eq('id', coordinatorId)
    .eq('role', 'coordinator')
    .maybeSingle()

  if (error) throw error
  return data
}
