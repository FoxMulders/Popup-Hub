import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNearbyMarketAlertEmail } from '@/lib/email/nearby-market-alert'
import type { VendorMarketAlertPrefs } from '@/lib/vendor/nearby-market-alerts'

const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000

export interface NearbyAlertRecipient {
  userId: string
  radiusKm: number
  distanceKm: number
  deepLink: string
}

export async function dispatchNearbyMarketAlertEmails(
  supabase: SupabaseClient,
  event: { id: string; name: string },
  recipients: NearbyAlertRecipient[]
): Promise<void> {
  if (recipients.length === 0) return

  const since = new Date(Date.now() - DIGEST_WINDOW_MS).toISOString()
  const userIds = [...new Set(recipients.map((r) => r.userId))]

  const [{ data: prefsRows }, { data: profiles }] = await Promise.all([
    supabase.from('vendor_market_alert_prefs').select('*').in('user_id', userIds),
    supabase.from('profiles').select('id, full_name, email').in('id', userIds),
  ])

  const prefsByUser = new Map(
    (prefsRows ?? []).map((row) => [row.user_id as string, row as VendorMarketAlertPrefs])
  )
  const profileByUser = new Map(
    (profiles ?? []).map((row) => [row.id as string, row as { full_name: string | null; email: string | null }])
  )

  for (const recipient of recipients) {
    const prefs = prefsByUser.get(recipient.userId)
    if (!prefs?.notify_email) continue

    const profile = profileByUser.get(recipient.userId)
    const email = profile?.email?.trim()
    if (!email) continue

    const { data: recentRows } = await supabase
      .from('notifications')
      .select('message, metadata')
      .eq('user_id', recipient.userId)
      .eq('type', 'nearby_market_published')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10)

    const marketNames = [
      event.name,
      ...(recentRows ?? [])
        .map((row) => {
          const meta = row.metadata as { event_id?: string } | null
          if (meta?.event_id === event.id) return null
          const match = /"([^"]+)"/.exec(row.message as string)
          return match?.[1] ?? null
        })
        .filter(Boolean) as string[],
    ]
    const uniqueNames = [...new Set(marketNames)].slice(0, 5)

    await sendNearbyMarketAlertEmail({
      vendorEmail: email,
      vendorName: profile?.full_name?.trim() || 'Vendor',
      marketCount: uniqueNames.length,
      marketNames: uniqueNames,
      radiusKm: Math.round(recipient.radiusKm),
      deepLink: recipient.deepLink,
    })
  }
}
