import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  const service = await createServiceClient()
  const access = await assertLegacyAuctionManager(service, id, user.id)

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  if (access.auction.status !== 'upcoming') {
    return NextResponse.json(
      { error: `Cannot cancel an auction that is ${access.auction.status}` },
      { status: 409 }
    )
  }

  const { error } = await service
    .from('auctions')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
