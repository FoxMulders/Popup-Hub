import type { SupabaseClient } from '@supabase/supabase-js'
import { syncPublishedEventToTrustDirectory } from '@/lib/organizers/sync-coordinator-event'

/** Sync a newly published PopUp Hub market into the trust directory. */
export async function onMarketPublished(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  const { data: event } = await supabase
    .from('events')
    .select('id, name, city, coordinator_id, start_at, status')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status !== 'published') return

  await syncPublishedEventToTrustDirectory(supabase, {
    id: event.id,
    name: event.name,
    city: event.city,
    coordinator_id: event.coordinator_id,
    start_at: event.start_at,
  })
}
