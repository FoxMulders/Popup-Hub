import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Gavel } from 'lucide-react'
import { statusLabel } from '@/lib/quarter-auction/state-machine'

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

  const [{ data: live }, { count }] = await Promise.all([
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

  if (!count && !live) return null

  const href =
    variant === 'vendor'
      ? `/vendor/events/${eventId}/quarter-auction`
      : `/events/${eventId}/quarter-auction`

  const isLive = live && ['bidding_open', 'bidding_closed', 'drawing'].includes(live.status)

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 ${
        isLive ? 'border-harvest-200 bg-harvest-50' : 'border-forest/20 bg-forest/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {isLive ? 'Live charity quarter auction' : 'Quarter auction catalog'}
          </p>
          {live ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {live.title} · {statusLabel(live.status)}
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
      </div>
    </div>
  )
}
