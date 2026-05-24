import type { SupabaseClient } from '@supabase/supabase-js'

interface NotifyAuctionStartingParams {
  auctionId: string
  auctionTitle: string
  eventId: string | null
}

export async function notifyAuctionStarting(
  supabase: SupabaseClient,
  { auctionId, auctionTitle, eventId }: NotifyAuctionStartingParams
): Promise<number> {
  const userIds = new Set<string>()

  if (eventId) {
    const { data: favorites } = await supabase
      .from('shopper_favorites')
      .select('user_id')
      .eq('event_id', eventId)

    for (const row of favorites ?? []) {
      userIds.add(row.user_id)
    }
  }

  const { data: fundedWallets } = await supabase
    .from('wallets')
    .select('user_id')
    .gt('balance', 0)

  for (const row of fundedWallets ?? []) {
    userIds.add(row.user_id)
  }

  if (userIds.size === 0) return 0

  const message = eventId
    ? `🔴 "${auctionTitle}" is live! Drop your quarters now.`
    : `🔴 "${auctionTitle}" quarter auction is live! Drop your quarters now.`

  const rows = Array.from(userIds).map((userId) => ({
    user_id: userId,
    type: 'auction_starting' as const,
    message,
    metadata: { auction_id: auctionId, event_id: eventId },
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('Failed to send auction_starting notifications:', error.message)
    return 0
  }

  return rows.length
}
