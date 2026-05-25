import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { QuarterAuctionEventBannerClient } from '@/components/quarter-auction/event-banner-client'
import type { QuarterAuctionSettings } from '@/types/database'

interface QuarterAuctionEventBannerProps {
  eventId: string
  /** Patron vs vendor link target */
  variant?: 'patron' | 'vendor'
}

export async function QuarterAuctionEventBanner({
  eventId,
  variant = 'patron',
}: QuarterAuctionEventBannerProps) {
  const supabase = await createClient()

  const [{ data: live }, { count }, { data: event }] = await Promise.all([
    supabase
      .from('auction_catalog_items')
      .select('id, title, status')
      .eq('event_id', eventId)
      .in('status', ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'])
      .order('queue_position', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('auction_catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('status', 'eq', 'cancelled'),
    supabase.from('events').select('start_at').eq('id', eventId).maybeSingle(),
  ])

  if (!count && !live) return null

  let settings: QuarterAuctionSettings
  try {
    const service = await createServiceClient()
    settings = await getOrCreateSettings(service, eventId)
  } catch (err) {
    console.error('[QuarterAuctionEventBanner] settings init failed', {
      eventId,
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }

  return (
    <QuarterAuctionEventBannerClient
      eventId={eventId}
      eventStartAt={event?.start_at ?? new Date().toISOString()}
      settings={settings}
      variant={variant}
      initialLive={live}
      initialCount={count ?? 0}
    />
  )
}
