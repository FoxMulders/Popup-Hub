import type { AuctionItemEntry } from '@/types/database'

export interface DrawResult {
  winningPaddleNumber: string
  winnerUserId: string
  winnerEntryId: string
  poolCredits: number
}

/** Randomly select ONE entry from the strict paid paddle pool for this item round. */
export function drawWinnerFromEntries(entries: AuctionItemEntry[]): DrawResult | null {
  if (entries.length === 0) return null
  const index = Math.floor(Math.random() * entries.length)
  const winner = entries[index]
  return {
    winningPaddleNumber: winner.paddle_number,
    winnerUserId: winner.user_id,
    winnerEntryId: winner.id,
    poolCredits: entries.reduce((sum, e) => sum + e.credits_spent, 0),
  }
}
