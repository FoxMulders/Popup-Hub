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
  const service = await createServiceClient()

  const [{ data: live }, { count }, { data: event }, settings] = await Promise.all([
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
    supabase.from('events').select('start_at').eq('id', eventId).single(),
    getOrCreateSettings(service, eventId),
  ])

  if (!count && !live) return null

  return (
    <QuarterAuctionEventBannerClient
      eventId={eventId}
      eventStartAt={event?.start_at ?? new Date().toISOString()}
      settings={settings as QuarterAuctionSettings}
      variant={variant}
      initialLive={live}
      initialCount={count ?? 0}
    />
  )
}
