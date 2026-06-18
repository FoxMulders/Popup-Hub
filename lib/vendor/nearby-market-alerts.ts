import type { SupabaseClient } from '@supabase/supabase-js'
import { distanceKm, formatDistance, type LatLng } from '@/lib/shopper/geo'

export type VendorMarketAlertPrefs = {
  user_id: string
  home_lat: number
  home_lng: number
  radius_km: number
  category_ids: string[] | null
  notify_push: boolean
  notify_email: boolean
  notify_in_app: boolean
}

export type PublishedEventForAlerts = {
  id: string
  name: string
  start_at: string | null
  latitude: number | null
  longitude: number | null
  city: string | null
}

function eventHasCoords(event: PublishedEventForAlerts): event is PublishedEventForAlerts & {
  latitude: number
  longitude: number
} {
  return (
    typeof event.latitude === 'number' &&
    Number.isFinite(event.latitude) &&
    typeof event.longitude === 'number' &&
    Number.isFinite(event.longitude)
  )
}

async function loadOpenCategoryIds(
  supabase: SupabaseClient,
  eventId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('event_category_limits')
    .select('category_id')
    .eq('event_id', eventId)
  return (data ?? []).map((row) => row.category_id as string)
}

function prefsMatchCategories(
  prefs: VendorMarketAlertPrefs,
  openCategoryIds: string[]
): boolean {
  if (!prefs.category_ids?.length) return true
  if (openCategoryIds.length === 0) return true
  return prefs.category_ids.some((id) => openCategoryIds.includes(id))
}

export async function notifyVendorsOfNearbyPublishedMarket(
  supabase: SupabaseClient,
  event: PublishedEventForAlerts
): Promise<{ notified: number }> {
  if (!eventHasCoords(event)) {
    return { notified: 0 }
  }

  const eventPoint: LatLng = { lat: event.latitude, lng: event.longitude }

  const [{ data: prefsRows }, { data: existingApps }, openCategoryIds] = await Promise.all([
    supabase.from('vendor_market_alert_prefs').select('*'),
    supabase.from('booth_applications').select('vendor_id').eq('event_id', event.id),
    loadOpenCategoryIds(supabase, event.id),
  ])

  const alreadyApplied = new Set((existingApps ?? []).map((row) => row.vendor_id as string))
  const dateLabel = event.start_at
    ? new Date(event.start_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'soon'

  const notifications: {
    user_id: string
    type: 'nearby_market_published'
    message: string
    metadata: Record<string, unknown>
  }[] = []

  for (const row of prefsRows ?? []) {
    const prefs = row as VendorMarketAlertPrefs
    if (!prefs.notify_in_app) continue
    if (alreadyApplied.has(prefs.user_id)) continue
    if (!prefsMatchCategories(prefs, openCategoryIds)) continue

    const km = distanceKm({ lat: prefs.home_lat, lng: prefs.home_lng }, eventPoint)
    if (km > prefs.radius_km) continue

    const distLabel = formatDistance(km)
    const location = event.city?.trim() ? `${event.city} · ${distLabel}` : distLabel

    notifications.push({
      user_id: prefs.user_id,
      type: 'nearby_market_published',
      message: `New market nearby: "${event.name}" on ${dateLabel} (${location}). Tap to apply.`,
      metadata: {
        event_id: event.id,
        distance_km: Math.round(km * 10) / 10,
        deep_link: `/vendor/events/${event.id}?apply=1`,
      },
    })
  }

  if (notifications.length === 0) {
    return { notified: 0 }
  }

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) {
    console.error('[nearby-market-alerts] insert failed', error)
    return { notified: 0 }
  }

  return { notified: notifications.length }
}
