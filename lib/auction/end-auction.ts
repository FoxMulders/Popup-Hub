import { selectWinner } from '@/lib/auction/winner'
import { sendSms } from '@/lib/twilio'
import type { AuctionDrop } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EndAuctionResult {
  winningPaddleId: string | null
  winnerUserId: string | null
  totalPot: number
  alreadyEnded: boolean
}

export async function endAuction(
  supabase: SupabaseClient,
  auctionId: string,
  options?: { notify?: boolean }
): Promise<EndAuctionResult> {
  const notify = options?.notify ?? true

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, status, title, winning_paddle_id, winner_user_id, pot_amount')
    .eq('id', auctionId)
    .single()

  if (!auction) {
    throw new Error('Auction not found')
  }

  if (auction.status === 'ended') {
    return {
      winningPaddleId: auction.winning_paddle_id,
      winnerUserId: auction.winner_user_id,
      totalPot: auction.pot_amount ?? 0,
      alreadyEnded: true,
    }
  }

  if (auction.status !== 'active') {
    throw new Error(`Auction is ${auction.status}`)
  }

  const { data: drops } = await supabase
    .from('auction_drops')
    .select('*')
    .eq('auction_id', auctionId)

  const winningPaddleId = selectWinner((drops ?? []) as AuctionDrop[])

  let winnerUserId: string | null = null
  if (winningPaddleId) {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('paddle_id', winningPaddleId)
      .single()
    winnerUserId = wallet?.user_id ?? null
  }

  const totalPot = (drops ?? []).reduce((sum: number, d) => sum + (d.amount as number), 0)

  const { error } = await supabase
    .from('auctions')
    .update({
      status: 'ended',
      winning_paddle_id: winningPaddleId,
      winner_user_id: winnerUserId,
      pot_amount: totalPot,
    })
    .eq('id', auctionId)
    .eq('status', 'active')

  if (error) {
    throw new Error(error.message)
  }

  if (notify && winnerUserId && winningPaddleId) {
    const auctionTitle = auction.title ?? 'the auction'

    await supabase.from('notifications').insert({
      user_id: winnerUserId,
      type: 'auction_won',
      message: `🎉 You won ${auctionTitle}! Your paddle ${winningPaddleId} was drawn as the winner.`,
      metadata: { auction_id: auctionId, winning_paddle_id: winningPaddleId },
    })

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', winnerUserId)
      .single()

    if (profile?.phone) {
      await sendSms(
        profile.phone,
        `🎉 Congratulations${profile.full_name ? ` ${profile.full_name}` : ''}! You won ${auctionTitle} on Popup Hub. Your paddle ${winningPaddleId} was the lucky draw winner!`
      )
    }
  }

  return {
    winningPaddleId,
    winnerUserId,
    totalPot,
    alreadyEnded: false,
  }
}

export async function endExpiredAuctions(supabase: SupabaseClient): Promise<number> {
  const { data: expired } = await supabase
    .from('auctions')
    .select('id')
    .eq('status', 'active')
    .lte('timer_ends_at', new Date().toISOString())

  let ended = 0
  for (const row of expired ?? []) {
    try {
      await endAuction(supabase, row.id)
      ended++
    } catch {
      // Skip rows that were ended concurrently
    }
  }
  return ended
}
