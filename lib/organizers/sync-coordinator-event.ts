import type { SupabaseClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '@/lib/organizers/slug'

type PublishedEvent = {
  id: string
  name: string
  city: string | null
  coordinator_id: string
  start_at: string | null
}

/** Sync a published PopUp Hub event into the trust directory for a claimed organizer. */
export async function syncPublishedEventToTrustDirectory(
  supabase: SupabaseClient,
  event: PublishedEvent
): Promise<void> {
  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, slug')
    .or(`claimed_by.eq.${event.coordinator_id},popup_hub_coordinator_id.eq.${event.coordinator_id}`)
    .eq('listing_status', 'published')
    .maybeSingle()

  let organizerId = organizer?.id

  if (!organizerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', event.coordinator_id)
      .maybeSingle()

    const displayName = profile?.full_name?.trim() || 'Market organizer'
    const slug = organizerSlugFromName(displayName)

    const { data: created } = await supabase
      .from('organizers')
      .upsert(
        {
          slug,
          display_name: displayName,
          city: event.city ?? 'Edmonton',
          province: 'AB',
          region: 'edmonton-metro',
          claimed_by: event.coordinator_id,
          popup_hub_coordinator_id: event.coordinator_id,
          claimed_at: new Date().toISOString(),
          listing_status: 'published',
          source: 'popup_hub',
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single()

    organizerId = created?.id
  } else {
    await supabase
      .from('organizers')
      .update({
        popup_hub_coordinator_id: event.coordinator_id,
        claimed_by: event.coordinator_id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizerId)
  }

  if (!organizerId) return

  const typicalDates = event.start_at
    ? new Date(event.start_at).toLocaleDateString('en-CA', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const { data: existing } = await supabase
    .from('organizer_events')
    .select('id')
    .eq('organizer_id', organizerId)
    .eq('popup_hub_event_id', event.id)
    .maybeSingle()

  const payload = {
    organizer_id: organizerId,
    name: event.name,
    city: event.city,
    typical_dates: typicalDates,
    source_snippet: 'Synced from PopUp Hub published market.',
    listing_status: 'published' as const,
    popup_hub_event_id: event.id,
  }

  if (existing) {
    await supabase.from('organizer_events').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('organizer_events').insert(payload)
  }
}
