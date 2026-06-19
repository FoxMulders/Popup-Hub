import { createClient } from '@/lib/supabase/server'
import type { Organizer, OrganizerEvent, OrganizerReviewPublic, OrganizerScamAlert } from '@/types/organizers'

const ORGANIZER_COLUMNS =
  'id, slug, display_name, primary_contact_name, city, province, region, website_url, facebook_url, instagram_handle, typical_season_or_dates, listing_status, source, admin_notes'

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
  if (error) throw error
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

  if (error) throw error
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

  if (error) throw error
  return (data ?? []) as OrganizerEvent[]
}

export async function getPublishedScamAlerts(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_scam_alerts')
    .select('id, organizer_id, alert_title, alert_body, verification_status, source_permalink, published')
    .eq('organizer_id', organizerId)
    .eq('published', true)

  if (error) throw error
  return (data ?? []) as OrganizerScamAlert[]
}

export async function getPublishedCommunityMentions(organizerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizer_community_mentions')
    .select('id, quote, sentiment, mention_type, coordinator_person_name, verification_status, source_permalink')
    .eq('organizer_id', organizerId)
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
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

  if (error) throw error

  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name?: string } | null
    const { profiles: _profiles, ...review } = row
    return {
      ...review,
      vendor_display_name: profile?.full_name ?? null,
    } as OrganizerReviewPublic
  })
}
