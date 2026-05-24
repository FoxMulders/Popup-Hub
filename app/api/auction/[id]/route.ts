import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  if (auction.status === 'active') {
    return NextResponse.json(
      { error: 'End the live auction before removing it' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('auctions').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
