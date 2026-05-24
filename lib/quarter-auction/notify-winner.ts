import { sendSms } from '@/lib/twilio'
import type { AuctionCatalogItem } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function notifyQuarterAuctionWinner(
  supabase: SupabaseClient,
  item: Pick<
    AuctionCatalogItem,
    'id' | 'title' | 'event_id' | 'winning_paddle_number' | 'winner_user_id'
  >
): Promise<void> {
  if (!item.winner_user_id || !item.winning_paddle_number) return

  const message = `🎉 You won "${item.title}"! Paddle #${item.winning_paddle_number} was drawn.`

  await supabase.from('notifications').insert({
    user_id: item.winner_user_id,
    type: 'auction_won',
    message,
    metadata: {
      catalog_item_id: item.id,
      event_id: item.event_id,
      winning_paddle_number: item.winning_paddle_number,
    },
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', item.winner_user_id)
    .single()

  if (profile?.phone) {
    await sendSms(
      profile.phone,
      `🎉 Congratulations${profile.full_name ? ` ${profile.full_name}` : ''}! You won "${item.title}" on Popup Hub. Paddle #${item.winning_paddle_number} was the lucky draw!`
    )
  }
}
