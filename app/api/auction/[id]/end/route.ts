import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { endAuction } from '@/lib/auction/end-auction'
import { assertLegacyAuctionManager } from '@/lib/auction/coordinator-access'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const access = await assertLegacyAuctionManager(admin, id, user.id)

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  if (access.auction.status !== 'active') {
    return NextResponse.json({ error: `Auction is ${access.auction.status}` }, { status: 409 })
  }

  try {
    const result = await endAuction(admin, id)
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
