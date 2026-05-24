import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { endAuction } from '@/lib/auction/end-auction'

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

  try {
    const result = await endAuction(supabase, id)
    return NextResponse.json({
      winningPaddleId: result.winningPaddleId,
      winnerUserId: result.winnerUserId,
      totalPot: result.totalPot,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to end auction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
