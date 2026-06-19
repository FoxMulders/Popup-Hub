import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyVendorsOfNearbyPublishedMarket } from '@/lib/vendor/nearby-market-alerts'
import { dispatchNativePushToUsers } from '@/lib/mobile/push-dispatch'

/** Fire nearby-vendor alerts when a market becomes published (idempotent if already published). */
export async function dispatchPublishMarketAlerts(
  supabase: SupabaseClient,
  eventId: string,
  options?: { wasPublished?: boolean }
): Promise<void> {
  if (options?.wasPublished) return

  const { data: event } = await supabase
    .from('events')
    .select('id, name, start_at, latitude, longitude, city, status')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status !== 'published') return

  const { notified } = await notifyVendorsOfNearbyPublishedMarket(supabase, event)

  if (notified > 0) {
    const { data: rows } = await supabase
      .from('notifications')
      .select('user_id, message, metadata')
      .eq('type', 'nearby_market_published')
      .contains('metadata', { event_id: eventId })
      .order('created_at', { ascending: false })
      .limit(notified)

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))]
    const { data: pushPrefs } = await supabase
      .from('vendor_market_alert_prefs')
      .select('user_id')
      .in('user_id', userIds)
      .eq('notify_push', true)
    const pushUserIds = (pushPrefs ?? []).map((p) => p.user_id as string)
    if (pushUserIds.length === 0) return

    const sample = rows?.[0]
    const meta = sample?.metadata as { deep_link?: string } | null

    await dispatchNativePushToUsers(supabase, {
      userIds: pushUserIds,
      title: 'New market nearby',
      body: (sample?.message as string) ?? `New market: ${event.name}`,
      deepLink: meta?.deep_link ?? `/vendor/events/${eventId}?apply=1`,
    })
  }
}
