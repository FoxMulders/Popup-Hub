import type { SupabaseClient } from '@supabase/supabase-js'
import { QUARTERS_IN_HEADLINE } from '@/lib/quarter-auction/credits'

interface NotifyBiddingOpenParams {
  catalogItemId: string
  itemTitle: string
  eventId: string
  entryCostCredits: number
}

/** Alert patrons who favorited the event or already bought paddles for it. */
export async function notifyQuarterAuctionBiddingOpen(
  supabase: SupabaseClient,
  { catalogItemId, itemTitle, eventId, entryCostCredits }: NotifyBiddingOpenParams
): Promise<number> {
  const userIds = new Set<string>()

  const [{ data: favorites }, { data: paddles }] = await Promise.all([
    supabase.from('shopper_favorites').select('user_id').eq('event_id', eventId),
    supabase.from('event_paddles').select('user_id').eq('event_id', eventId),
  ])

  for (const row of favorites ?? []) userIds.add(row.user_id)
  for (const row of paddles ?? []) userIds.add(row.user_id)

  if (userIds.size === 0) return 0

  const message = `🔴 ${QUARTERS_IN_HEADLINE} "${itemTitle}" — ${entryCostCredits} credit${entryCostCredits === 1 ? '' : 's'} per paddle. Select your paddles now!`

  const rows = Array.from(userIds).map((userId) => ({
    user_id: userId,
    type: 'auction_starting' as const,
    message,
    metadata: { catalog_item_id: catalogItemId, event_id: eventId },
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('Failed to send quarter auction bidding notifications:', error.message)
    return 0
  }

  return rows.length
}
