import type { SupabaseClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '@/lib/organizers/slug'

type PublishedEvent = {
  id: string
  name: string
  city: string | null
  coordinator_id: string
  start_at: string | null
}

type OrganizerLinkRow = {
  id: string
  slug: string
  claimed_by: string | null
  popup_hub_coordinator_id: string | null
  source: string | null
}

/** Whether publish sync may set claimed_by for an existing organizer row. */
export function canAutoClaimOrganizerOnPublish(
  organizer: Pick<OrganizerLinkRow, 'claimed_by' | 'popup_hub_coordinator_id'>,
  coordinatorId: string
): boolean {
  return (
    organizer.claimed_by === coordinatorId ||
    organizer.popup_hub_coordinator_id === coordinatorId
  )
}

function organizerUpdatePayload(
  organizer: Pick<OrganizerLinkRow, 'claimed_by' | 'popup_hub_coordinator_id'>,
  coordinatorId: string,
  now: string
): Record<string, string> {
  const payload: Record<string, string> = {
    popup_hub_coordinator_id: coordinatorId,
    updated_at: now,
  }

  if (canAutoClaimOrganizerOnPublish(organizer, coordinatorId)) {
    payload.claimed_by = coordinatorId
    payload.claimed_at = now
  }

  return payload
}

/** Sync a published PopUp Hub event into the trust directory for a claimed organizer. */
export async function syncPublishedEventToTrustDirectory(
  supabase: SupabaseClient,
  event: PublishedEvent
): Promise<void> {
  const { data: linkedOrganizer } = await supabase
    .from('organizers')
    .select('id, slug, claimed_by, popup_hub_coordinator_id, source')
    .or(`claimed_by.eq.${event.coordinator_id},popup_hub_coordinator_id.eq.${event.coordinator_id}`)
    .eq('listing_status', 'published')
    .maybeSingle()

  let organizerId = linkedOrganizer?.id

  if (!organizerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', event.coordinator_id)
      .maybeSingle()

    const displayName = profile?.full_name?.trim() || 'Market organizer'
    const slug = organizerSlugFromName(displayName)

    const { data: existingBySlug } = await supabase
      .from('organizers')
      .select('id, slug, claimed_by, popup_hub_coordinator_id, source')
      .eq('slug', slug)
      .eq('listing_status', 'published')
      .maybeSingle()

    if (existingBySlug) {
      if (!canAutoClaimOrganizerOnPublish(existingBySlug, event.coordinator_id)) {
        // HubGuard profiles require admin-approved claims — never overwrite via publish sync.
        return
      }
      organizerId = existingBySlug.id
    } else {
      const now = new Date().toISOString()
      const { data: created } = await supabase
        .from('organizers')
        .insert({
          slug,
          display_name: displayName,
          city: event.city ?? 'Edmonton',
          province: 'AB',
          region: 'edmonton-metro',
          claimed_by: event.coordinator_id,
          popup_hub_coordinator_id: event.coordinator_id,
          claimed_at: now,
          listing_status: 'published',
          source: 'popup_hub',
        })
        .select('id')
        .single()

      organizerId = created?.id
    }
  } else if (linkedOrganizer) {
    const now = new Date().toISOString()
    await supabase
      .from('organizers')
      .update(organizerUpdatePayload(linkedOrganizer, event.coordinator_id, now))
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
