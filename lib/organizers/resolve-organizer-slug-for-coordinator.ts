import type { SupabaseClient } from '@supabase/supabase-js'

/** Published HubGuard organizer slug linked to a PopUp Hub coordinator profile. */
export async function resolveOrganizerSlugForCoordinator(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('organizers')
    .select('slug')
    .eq('listing_status', 'published')
    .or(`claimed_by.eq.${coordinatorId},popup_hub_coordinator_id.eq.${coordinatorId}`)
    .order('claimed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return data?.slug ?? null
}
