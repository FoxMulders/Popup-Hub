import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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
    .select('id, coordinator_id, status, timer_duration_seconds')
    .eq('id', id)
    .single()

  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  if (auction.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (auction.status !== 'upcoming') {
    return NextResponse.json({ error: `Auction is already ${auction.status}` }, { status: 409 })
  }

  const timerEndsAt = new Date(
    Date.now() + auction.timer_duration_seconds * 1000
  ).toISOString()

  const { error } = await supabase
    .from('auctions')
    .update({ status: 'active', timer_ends_at: timerEndsAt })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ timerEndsAt })
}
