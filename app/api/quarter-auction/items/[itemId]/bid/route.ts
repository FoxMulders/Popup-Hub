import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { deductWalletCredits } from '@/lib/quarter-auction/wallet'

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

  const { data: item } = await service
    .from('auction_catalog_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }
  if (item.status !== 'bidding_open') {
    return NextResponse.json({ error: 'Bidding is not open' }, { status: 422 })
  }
  if (!item.entry_cost_credits || item.entry_cost_credits <= 0) {
    return NextResponse.json({ error: 'Entry cost not set' }, { status: 422 })
  }

  const { data: paddles } = await service
    .from('event_paddles')
    .select('*')
    .eq('event_id', item.event_id)
    .eq('user_id', user.id)
    .in('id', paddleIds)

  if (!paddles || paddles.length !== paddleIds.length) {
    return NextResponse.json({ error: 'Invalid paddle selection' }, { status: 400 })
  }

  const { data: existing } = await service
    .from('auction_item_entries')
    .select('paddle_id')
    .eq('catalog_item_id', itemId)
    .in('paddle_id', paddleIds)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'One or more paddles already entered this round' }, { status: 422 })
  }

  const totalCredits = item.entry_cost_credits * paddles.length
  const deduct = await deductWalletCredits(service, user.id, totalCredits, 'bid_entry', {
    catalog_item_id: itemId,
    event_id: item.event_id,
    paddle_ids: paddleIds,
  })

  if (!deduct.ok) {
    return NextResponse.json({ error: deduct.error }, { status: 402 })
  }

  const rows = paddles.map((p) => ({
    catalog_item_id: itemId,
    paddle_id: p.id,
    user_id: user.id,
    paddle_number: p.paddle_number,
    credits_spent: item.entry_cost_credits,
  }))

  const { data: entries, error } = await service
    .from('auction_item_entries')
    .insert(rows)
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  await service
    .from('auction_catalog_items')
    .update({
      pool_credits: (item.pool_credits ?? 0) + totalCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  return NextResponse.json({ entries, newBalance: deduct.newBalance })
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
