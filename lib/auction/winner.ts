import type { AuctionDrop } from '@/types/database'

/**
 * Selects a winning paddle using cryptographically secure randomness.
 * Each drop counts as one ticket — weighted by drop count, not amount.
 * Uses crypto.getRandomValues (Web Crypto API, available in Node 15+).
 */
export function selectWinner(drops: AuctionDrop[]): string | null {
  if (drops.length === 0) return null

  // Build weighted ticket pool: each drop = 1 entry for its paddle_id
  const tickets: string[] = drops.map((d) => d.paddle_id)

  // Cryptographically secure random index
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)

  const index = array[0] % tickets.length
  return tickets[index]
}

/**
 * Groups drops by paddle and returns a leaderboard sorted by total amount dropped.
 */
export function buildLeaderboard(
  drops: AuctionDrop[]
): Array<{ paddleId: string; totalCents: number; dropCount: number }> {
  const map = new Map<string, { totalCents: number; dropCount: number }>()

  for (const drop of drops) {
    const existing = map.get(drop.paddle_id) ?? { totalCents: 0, dropCount: 0 }
    map.set(drop.paddle_id, {
      totalCents: existing.totalCents + drop.amount,
      dropCount: existing.dropCount + 1,
    })
  }

  return Array.from(map.entries())
    .map(([paddleId, stats]) => ({ paddleId, ...stats }))
    .sort((a, b) => b.totalCents - a.totalCents)
}
