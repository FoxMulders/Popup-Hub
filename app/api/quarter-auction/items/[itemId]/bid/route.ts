import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { placeCatalogBidEntries } from '@/lib/quarter-auction/place-catalog-bid'

interface RouteParams {
  params: Promise<{ itemId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { itemId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const paddleIds = body.paddle_ids as string[] | undefined

  if (!paddleIds?.length) {
    return NextResponse.json({ error: 'Select at least one paddle' }, { status: 400 })
  }

  const service = await createServiceClient()

  const result = await placeCatalogBidEntries(service, {
    catalogItemId: itemId,
    userId: user.id,
    paddleIds,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ entries: result.entries, newBalance: result.newBalance })
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { itemId } = await params
  const supabase = await createClient()

  const { data: entries } = await supabase
    .from('auction_item_entries')
    .select('*')
    .eq('catalog_item_id', itemId)
    .order('entered_at', { ascending: true })

  return NextResponse.json({ entries: entries ?? [] })
}
