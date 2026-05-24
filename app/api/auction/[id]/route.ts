import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { assertLegacyAuctionManager } from '@/lib/auction/coordinator-access'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Props) {
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

  if (access.auction.status === 'active') {
    return NextResponse.json(
      { error: 'End the live auction before removing it' },
      { status: 409 }
    )
  }

  const { error } = await admin.from('auctions').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
