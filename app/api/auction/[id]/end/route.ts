import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { selectWinner } from '@/lib/auction/winner'
import { sendSms } from '@/lib/twilio'
import type { AuctionDrop } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, coordinator_id, status')
    .eq('id', id)
    .single()

  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  if (auction.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (auction.status !== 'active') {
    return NextResponse.json({ error: `Auction is ${auction.status}` }, { status: 409 })
  }

  // Fetch all drops
  const { data: drops } = await supabase
    .from('auction_drops')
    .select('*')
    .eq('auction_id', id)

  const winningPaddleId = selectWinner((drops ?? []) as AuctionDrop[])

  // Find winner's user_id
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

  await supabase
    .from('auctions')
    .update({
      status: 'ended',
      winning_paddle_id: winningPaddleId,
      winner_user_id: winnerUserId,
      pot_amount: totalPot,
    })
    .eq('id', id)

  // Notify winner in-app + SMS
  if (winnerUserId) {
    const { data: auctionDetails } = await supabase
      .from('auctions')
      .select('title')
      .eq('id', id)
      .single()
    const auctionTitle = auctionDetails?.title ?? 'the auction'

    await supabase.from('notifications').insert({
      user_id: winnerUserId,
      type: 'auction_won',
      message: `🎉 You won ${auctionTitle}! Your paddle ${winningPaddleId} was drawn as the winner.`,
      metadata: { auction_id: id, winning_paddle_id: winningPaddleId },
    })

    // Fetch winner's phone for optional SMS
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

  return NextResponse.json({ winningPaddleId, winnerUserId, totalPot })
}
