import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyVendorsOfNearbyPublishedMarket } from '@/lib/vendor/nearby-market-alerts'
import { dispatchNearbyMarketAlertEmails } from '@/lib/vendor/dispatch-nearby-market-emails'
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

  const { notified, emailRecipients } = await notifyVendorsOfNearbyPublishedMarket(supabase, event)

  if (emailRecipients.length > 0) {
    void dispatchNearbyMarketAlertEmails(supabase, { id: event.id, name: event.name }, emailRecipients).catch(
      (err) => {
        console.error('[publish] nearby vendor alert emails failed', err)
      }
    )
  }

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
