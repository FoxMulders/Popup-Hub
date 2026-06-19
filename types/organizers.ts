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
