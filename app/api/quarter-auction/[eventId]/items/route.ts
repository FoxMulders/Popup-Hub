import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertEventCoordinator } from '@/lib/auction/coordinator-access'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: approval } = await supabase
    .from('quarter_auction_vendor_approvals')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', user.id)
    .maybeSingle()

  if (!approval) {
    return NextResponse.json({ error: 'Vendor not approved for this auction' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, image_url, retail_value_cents, entry_cost_credits } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  if (
    entry_cost_credits != null &&
    (!Number.isFinite(Number(entry_cost_credits)) || Number(entry_cost_credits) < 1)
  ) {
    return NextResponse.json({ error: 'Quarters per paddle must be at least 1' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { count } = await service
    .from('auction_catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  const { data: item, error } = await service
    .from('auction_catalog_items')
    .insert({
      event_id: eventId,
      vendor_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      retail_value_cents: retail_value_cents ?? null,
      entry_cost_credits: entry_cost_credits ?? null,
      queue_position: count ?? 0,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ item })
}

const REMOVABLE_STATUSES = new Set(['draft', 'queued', 'cancelled', 'completed'])

function isLiveCatalogStatus(status: string): boolean {
  return ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'].includes(status)
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const access = await assertEventCoordinator(service, eventId, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = await request.json().catch(() => ({}))
  const itemIds = Array.isArray(body.item_ids) ? (body.item_ids as string[]) : null
  const clearAll = body.clear_all === true

  let query = service
    .from('auction_catalog_items')
    .select('id, status')
    .eq('event_id', eventId)

  if (itemIds?.length) {
    query = query.in('id', itemIds)
  } else if (clearAll) {
    query = query.in('status', ['draft', 'queued', 'cancelled', 'completed'])
  } else {
    return NextResponse.json({ error: 'Provide item_ids or clear_all' }, { status: 400 })
  }

  const { data: targets, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 422 })
  }

  const removable = (targets ?? []).filter(
    (row) => REMOVABLE_STATUSES.has(row.status) && !isLiveCatalogStatus(row.status)
  )

  if (removable.length === 0) {
    return NextResponse.json({ error: 'No removable items found', removed: 0 }, { status: 422 })
  }

  const { error: deleteError } = await service
    .from('auction_catalog_items')
    .delete()
    .in(
      'id',
      removable.map((r) => r.id)
    )

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 422 })
  }

  return NextResponse.json({ removed: removable.length, ids: removable.map((r) => r.id) })
}
