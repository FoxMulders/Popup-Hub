import Link from 'next/link'
import { Gavel, Trophy, Clock } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import type { Auction } from '@/types/database'

interface LiveAuctionBannerProps {
  activeAuction: Auction | null
  upcomingAuction: Auction | null
  lastEndedAuction: Auction | null
  /** When set, shows a top-up nudge if balance is below the auction min drop. */
  walletBalanceCents?: number | null
}

function needsWalletTopUp(
  balanceCents: number | null | undefined,
  minDropCents: number
): boolean {
  if (balanceCents == null) return true
  return balanceCents < minDropCents
}

export function LiveAuctionBanner({
  activeAuction,
  upcomingAuction,
  lastEndedAuction,
  walletBalanceCents,
}: LiveAuctionBannerProps) {
  if (activeAuction) {
    const lowBalance = needsWalletTopUp(walletBalanceCents, activeAuction.min_drop_amount)
    return (
      <div className="mt-4 rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-harvest-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-harvest-900">Live quarter auction</p>
            <p className="mt-0.5 text-sm text-harvest-800">{activeAuction.title}</p>
            {activeAuction.pot_amount > 0 && (
              <p className="mt-1 text-xs text-harvest-700">
                Pot: {formatCents(activeAuction.pot_amount)}
              </p>
            )}
            {lowBalance ? (
              <p className="mt-2 text-xs font-medium text-harvest-700">
                Wallet low — top up to drop quarters (min {formatCents(activeAuction.min_drop_amount)}).
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href={`/auctions/${activeAuction.id}`}
                className="text-sm font-medium text-forest underline"
              >
                Join now →
              </Link>
              {lowBalance ? (
                <Link href="/wallet" className="text-sm font-medium text-forest underline">
                  Top up wallet →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (upcomingAuction) {
    const lowBalance = needsWalletTopUp(walletBalanceCents, upcomingAuction.min_drop_amount)
    return (
      <div className="mt-4 rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-harvest-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-harvest-800">Quarter auction coming up</p>
            <p className="mt-0.5 text-sm text-harvest-700">{upcomingAuction.title}</p>
            <p className="mt-1 text-xs text-harvest-700">
              {lowBalance
                ? `Top up your wallet — you'll need at least ${formatCents(upcomingAuction.min_drop_amount)} per drop.`
                : "Top up your wallet to get ready — you'll need a paddle ID to drop quarters."}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/wallet" className="text-sm font-medium text-forest underline">
                Top up wallet →
              </Link>
              <Link
                href={`/auctions/${upcomingAuction.id}`}
                className="text-sm font-medium text-forest underline"
              >
                View details →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (lastEndedAuction?.winning_paddle_id) {
    return (
      <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-harvest-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Auction ended</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{lastEndedAuction.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Winner: Paddle #{lastEndedAuction.winning_paddle_id}
              {lastEndedAuction.pot_amount > 0
                ? ` · Pot ${formatCents(lastEndedAuction.pot_amount)}`
                : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
