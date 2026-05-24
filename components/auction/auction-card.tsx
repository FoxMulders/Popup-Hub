import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatCents } from '@/lib/square/client'
import { cn } from '@/lib/utils'
import type { Auction } from '@/types/database'
import { Gavel, Trophy } from 'lucide-react'

interface AuctionCardProps {
  auction: Pick<Auction, 'id' | 'title' | 'status' | 'pot_amount' | 'winning_paddle_id' | 'item_name'>
  eventId: string
  /** Patron/vendor link target; defaults to participant room */
  href?: string
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-harvest-300 bg-harvest-50',
  upcoming: 'border-amber-200 bg-amber-50/50',
  ended: 'border-stone-200 bg-stone-50',
  cancelled: 'border-stone-200 bg-stone-50 opacity-60',
}

export function AuctionCard({ auction, eventId, href, className }: AuctionCardProps) {
  const roomHref = href ?? `/auctions/${auction.id}`
  const manageHref = `/coordinator/events/${eventId}/auctions`

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4',
        STATUS_STYLES[auction.status] ?? 'border-stone-200 bg-white',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 shrink-0 text-harvest-700" aria-hidden />
          <p className="font-medium truncate">{auction.title}</p>
        </div>
        {auction.item_name && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{auction.item_name}</p>
        )}
        {auction.status === 'ended' && auction.winning_paddle_id && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="h-3 w-3 text-amber-500" aria-hidden />
            Winner: Paddle #{auction.winning_paddle_id}
            {auction.pot_amount > 0 && <> · {formatCents(auction.pot_amount)}</>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="capitalize">
          {auction.status === 'active' ? 'Live' : auction.status}
        </Badge>
        <Link href={roomHref} className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
          {auction.status === 'active' ? 'Join' : 'View'}
        </Link>
        <Link href={manageHref} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          Manage
        </Link>
      </div>
    </div>
  )
}
