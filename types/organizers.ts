export type ListingStatus = 'draft' | 'published' | 'archived'

export type VerificationStatus =
  | 'ai_extract_unverified'
  | 'human_saw_in_group'
  | 'permalink_verified'
  | 'screenshot_verified'
  | 'official_site_corroborated'
  | 'admin_confirmed'

export type Organizer = {
  id: string
  slug: string
  display_name: string
  primary_contact_name: string | null
  city: string
  province: string
  region: string
  website_url: string | null
  facebook_url: string | null
  instagram_handle: string | null
  typical_season_or_dates: string | null
  listing_status: ListingStatus
  source: string
  admin_notes: string | null
  claimed_by: string | null
  claimed_at: string | null
  popup_hub_coordinator_id: string | null
}

export type OrganizerEvent = {
  id: string
  organizer_id: string
  name: string
  city: string | null
  typical_dates: string | null
  booth_fee_cad: number | null
  source_snippet: string | null
  listing_status: ListingStatus
}

export type OrganizerScamAlert = {
  id: string
  organizer_id: string
  alert_title: string
  alert_body: string
  verification_status: VerificationStatus
  source_permalink: string | null
  published: boolean
}

export type ScamWatchlistEntry = {
  id: string
  slug: string
  display_name: string
  warning_title: string
  warning_body: string
  verification_status: VerificationStatus
  published: boolean
}

export type OrganizerReview = {
  id: string
  organizer_id: string
  vendor_id: string
  event_name: string
  event_month_year: string
  event_as_advertised: 'yes' | 'partial' | 'no'
  would_return: boolean
  attendance_vs_expectations: 'much_lower' | 'lower' | 'about_right' | 'higher'
  communication_rating: number
  refund_experience: 'na' | 'fast' | 'slow' | 'never_received'
  optional_notes: string | null
  verification_tier: 'unverified' | 'receipt_verified' | 'invited_verified' | 'platform_verified'
  published: boolean
  created_at: string
}

export type OrganizerReviewPublic = OrganizerReview & {
  vendor_display_name: string | null
  response_body: string | null
  response_created_at: string | null
}

export type CommunityMention = {
  id: string
  quote: string
  sentiment: string | null
  mention_type: string
  coordinator_person_name: string | null
  verification_status: VerificationStatus
  source_permalink: string | null
  source_snippet: string | null
  responds_to_mention_id: string | null
  display_order: number
  response_body: string | null
}
