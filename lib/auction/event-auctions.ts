import type { Auction } from '@/types/database'

export interface EventAuctionSummary {
  active: Auction | null
  upcoming: Auction | null
  lastEnded: Auction | null
}

export function summarizeEventAuctions(auctions: Auction[]): EventAuctionSummary {
  const active = auctions.find((a) => a.status === 'active') ?? null
  const upcoming = auctions.find((a) => a.status === 'upcoming') ?? null
  const ended = auctions
    .filter((a) => a.status === 'ended')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const lastEnded = ended[0] ?? null

  return { active, upcoming, lastEnded }
}
