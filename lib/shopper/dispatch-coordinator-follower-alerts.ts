import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyCoordinatorFollowersOfPublishedMarket } from '@/lib/shopper/notify-coordinator-followers'

/** Notify patrons who follow this organizer when a market becomes published. */
export async function dispatchCoordinatorFollowerAlerts(
  supabase: SupabaseClient,
  eventId: string,
  options?: { wasPublished?: boolean }
): Promise<void> {
  if (options?.wasPublished) return

  const { data: event } = await supabase
    .from('events')
    .select('id, name, start_at, coordinator_id, status, coordinator:profiles!events_coordinator_id_fkey(full_name)')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status !== 'published') return

  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const coordinatorName =
    (coordinator as { full_name?: string | null } | null)?.full_name?.trim() || 'An organizer you follow'

  await notifyCoordinatorFollowersOfPublishedMarket(
    supabase,
    {
      id: event.id,
      name: event.name,
      start_at: event.start_at,
      coordinator_id: event.coordinator_id,
    },
    coordinatorName
  )
}
