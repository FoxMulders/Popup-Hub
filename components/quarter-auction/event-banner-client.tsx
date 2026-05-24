'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Gavel } from 'lucide-react'
import { useEffect, useState } from 'react'
import { statusLabel, patronStatusHeadline } from '@/lib/quarter-auction/state-machine'
import type { AuctionItemStatus } from '@/types/database'
import { DismissibleAuctionBanner } from '@/components/auction/dismissible-auction-banner'
import { AuctionStartCountdown } from '@/components/quarter-auction/auction-start-countdown'
import type { QuarterAuctionSettings } from '@/types/database'

interface QuarterAuctionEventBannerClientProps {
  eventId: string
  eventStartAt: string
  settings: QuarterAuctionSettings
  variant?: 'patron' | 'vendor'
  initialLive: { id: string; title: string; status: string } | null
  initialCount: number
}

export function QuarterAuctionEventBannerClient({
  eventId,
  eventStartAt,
  settings,
  variant = 'patron',
  initialLive,
  initialCount,
}: QuarterAuctionEventBannerClientProps) {
  const [live, setLive] = useState(initialLive)
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`qa-banner:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_catalog_items', filter: `event_id=eq.${eventId}` },
        async () => {
          const [{ data: liveRow }, { count: itemCount }] = await Promise.all([
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
          ])
          setLive(liveRow)
          setCount(itemCount ?? 0)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])

  if (!count && !live) return null

  const href =
    variant === 'vendor'
      ? `/vendor/events/${eventId}/quarter-auction`
      : `/events/${eventId}/quarter-auction`

  const isLive = live && ['bidding_open', 'bidding_closed', 'drawing'].includes(live.status)

  return (
    <DismissibleAuctionBanner scope={`quarter-${variant}`} id={eventId}>
      <div
        className={`rounded-xl border px-4 py-3 ${
          isLive ? 'border-harvest-200 bg-harvest-50' : 'border-forest/20 bg-forest/5'
        }`}
      >
        <div className="flex items-start gap-3 pr-8">
          <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isLive ? 'Live charity quarter auction' : 'Quarter auction catalog'}
              </p>
              {live ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {live.title} ·{' '}
                  {variant === 'patron' && live.status === 'bidding_open'
                    ? patronStatusHeadline('bidding_open')
                    : statusLabel(live.status as AuctionItemStatus)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {count} item{count === 1 ? '' : 's'} in the lineup
                </p>
              )}
              <Link href={href} className="mt-2 inline-block text-sm font-medium text-forest underline">
                {variant === 'vendor' ? 'Vendor dashboard →' : 'Join live auction →'}
              </Link>
            </div>
            <AuctionStartCountdown
              scheduledStartAt={settings.scheduled_start_at}
              eventStartAt={eventStartAt}
              className="rounded-lg border border-harvest-200/80 bg-white/70 px-3 py-2 text-xs text-harvest-900"
            />
          </div>
        </div>
      </div>
    </DismissibleAuctionBanner>
  )
}
