import { createClient } from '@/lib/supabase/server'
import {
  rankOrganizerClaimSuggestions,
  type OrganizerClaimSuggestion,
} from '@/lib/organizers/match-coordinator-organizers'

const UNCLAIMED_ORGANIZER_COLUMNS =
  'id, slug, display_name, primary_contact_name, city, province, website_url, claimed_by, popup_hub_coordinator_id'

export async function fetchCoordinatorClaimSuggestions(
  userId: string
): Promise<OrganizerClaimSuggestion[]> {
  const supabase = await createClient()

  const [{ data: profile }, { data: events }, { data: organizers }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, coordinator_organization_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('events').select('name').eq('coordinator_id', userId).limit(20),
    supabase
      .from('organizers')
      .select(UNCLAIMED_ORGANIZER_COLUMNS)
      .eq('listing_status', 'published')
      .is('claimed_by', null)
      .is('popup_hub_coordinator_id', null)
      .order('display_name')
      .limit(250),
  ])

  if (!profile?.email) return []

  const unclaimed = (organizers ?? []).filter(
    (row) => !row.claimed_by && !row.popup_hub_coordinator_id
  )

  return rankOrganizerClaimSuggestions(unclaimed, {
    fullName: profile.full_name?.trim() ?? '',
    email: profile.email.trim(),
    organizationName: profile.coordinator_organization_name?.trim() ?? null,
    eventNames: (events ?? [])
      .map((event) => event.name?.trim())
      .filter((name): name is string => Boolean(name)),
  })
}
