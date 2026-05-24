import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertAuctionParticipant } from '@/lib/quarter-auction/participation'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: auctionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amount } = await request.json()
  if (!amount || typeof amount !== 'number' || amount < 25) {
    return NextResponse.json({ error: 'Invalid drop amount' }, { status: 400 })
  }

  const { data: auction } = await supabase
    .from('auctions')
    .select('status, min_drop_amount, max_drop_amount, timer_ends_at, pot_amount, event_id')
    .eq('id', auctionId)
    .single()

  if (!auction || auction.status !== 'active') {
    return NextResponse.json({ error: 'Auction is not active' }, { status: 422 })
  }

  if (!auction.event_id) {
    return NextResponse.json({ error: 'This auction is not tied to an event' }, { status: 422 })
  }

  const service = await createServiceClient()
  const participation = await assertAuctionParticipant(service, auction.event_id, user.id)
  if (!participation.ok) {
    return NextResponse.json({ error: participation.error }, { status: participation.status })
  }

  if (auction.timer_ends_at && new Date(auction.timer_ends_at) <= new Date()) {
    return NextResponse.json({ error: 'Auction timer has expired' }, { status: 422 })
  }

  if (amount < auction.min_drop_amount || amount > auction.max_drop_amount) {
    return NextResponse.json({ error: 'Drop amount out of range' }, { status: 422 })
  }

  const { data: wallet } = await service
    .from('wallets')
    .select('id, balance, paddle_id')
    .eq('user_id', user.id)
    .single()

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  }
  if (!wallet.paddle_id) {
    return NextResponse.json({ error: 'No paddle ID. Please fund your wallet first.' }, { status: 422 })
  }
  if (wallet.balance < amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 422 })
  }

  const { error: walletError } = await service
    .from('wallets')
    .update({ balance: wallet.balance - amount })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance)

  if (walletError) {
    return NextResponse.json({ error: 'Balance update conflict, please retry' }, { status: 409 })
  }

  await service.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'quarter_drop',
    amount: -amount,
    metadata: { auction_id: auctionId },
  })

  const { error: dropError } = await service.from('auction_drops').insert({
    auction_id: auctionId,
    user_id: user.id,
    paddle_id: wallet.paddle_id,
    amount,
  })

  if (dropError) {
    await service.from('wallets').update({ balance: wallet.balance }).eq('id', wallet.id)
    return NextResponse.json({ error: 'Failed to record drop' }, { status: 500 })
  }

  await service
    .from('auctions')
    .update({ pot_amount: (auction.pot_amount ?? 0) + amount })
    .eq('id', auctionId)

  return NextResponse.json({ success: true })
}
