import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

export type PublishedEventForCoordinatorAlerts = {
  id: string
  name: string
  start_at: string | null
  coordinator_id: string
}

export async function notifyCoordinatorFollowersOfPublishedMarket(
  supabase: SupabaseClient,
  event: PublishedEventForCoordinatorAlerts,
  coordinatorName: string
): Promise<{ notified: number }> {
  const { data: followers } = await supabase
    .from('coordinator_follows')
    .select('user_id')
    .eq('coordinator_id', event.coordinator_id)

  const followerIds = (followers ?? [])
    .map((row) => row.user_id as string)
    .filter((id) => id !== event.coordinator_id)

  if (followerIds.length === 0) {
    return { notified: 0 }
  }

  const dateLabel = event.start_at
    ? format(new Date(event.start_at), 'EEE, MMM d')
    : 'soon'

  const notifications = followerIds.map((userId) => ({
    user_id: userId,
    type: 'coordinator_market_published' as const,
    message: `${coordinatorName} published "${event.name}" — ${dateLabel}. Tap to view the lineup.`,
    metadata: {
      event_id: event.id,
      coordinator_id: event.coordinator_id,
      deep_link: `/events/${event.id}`,
    },
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) {
    console.error('[coordinator-followers] insert failed', error)
    return { notified: 0 }
  }

  return { notified: notifications.length }
}
