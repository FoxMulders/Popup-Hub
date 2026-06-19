import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { transitionCatalogItem, rollDraw } from '@/lib/quarter-auction/catalog'
import {
  assertEventCoordinator,
  resolveEventCoordinatorId,
} from '@/lib/auction/coordinator-access'
import type { AuctionItemStatus } from '@/types/database'

interface RouteParams {
  params: Promise<{ itemId: string }>
}

const REMOVABLE_STATUSES = new Set(['draft', 'queued', 'cancelled', 'completed'])

function isLiveCatalogStatus(status: string): boolean {
  return ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'].includes(status)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { itemId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const service = await createServiceClient()

  const { data: item } = await service
    .from('auction_catalog_items')
    .select('*, event:events(coordinator_id)')
    .eq('id', itemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const eventCoordinatorId = resolveEventCoordinatorId(
    item.event as { coordinator_id: string } | { coordinator_id: string }[] | null
  )
  const isCoordinator = eventCoordinatorId === user.id
  const isVendor = item.vendor_id === user.id

  if (isVendor && item.status === 'draft') {
    const { title, description, image_url, retail_value_cents, entry_cost_credits } = body
    if (
      entry_cost_credits != null &&
      (!Number.isFinite(Number(entry_cost_credits)) || Number(entry_cost_credits) < 1)
    ) {
      return NextResponse.json({ error: 'Quarters per paddle must be at least 1' }, { status: 400 })
    }
    const { data: updated, error } = await service
      .from('auction_catalog_items')
      .update({
        title: title?.trim() ?? item.title,
        description: description?.trim() ?? item.description,
        image_url: image_url ?? item.image_url,
        retail_value_cents: retail_value_cents ?? item.retail_value_cents,
        ...(entry_cost_credits !== undefined
          ? { entry_cost_credits: entry_cost_credits ?? null }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ item: updated })
  }

  if (!isCoordinator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (body.entry_cost_credits != null) {
    const { data: updated, error } = await service
      .from('auction_catalog_items')
      .update({
        entry_cost_credits: body.entry_cost_credits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ item: updated })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
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
  const action = body.action as string
  const service = await createServiceClient()

  try {
    if (action === 'approve') {
      const { data: item } = await service
        .from('auction_catalog_items')
        .select('*, event:events(coordinator_id)')
        .eq('id', itemId)
        .single()

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }

      const eventCoordinatorId = resolveEventCoordinatorId(
        item.event as { coordinator_id: string } | { coordinator_id: string }[] | null
      )
      if (eventCoordinatorId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: updated, error } = await service
        .from('auction_catalog_items')
        .update({
          status: 'queued',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      return NextResponse.json({ item: updated })
    }

    if (action === 'transition') {
      const toStatus = body.to_status as AuctionItemStatus
      const extra =
        toStatus === 'active_price_setting' && body.entry_cost_credits != null
          ? { entry_cost_credits: body.entry_cost_credits }
          : undefined

      const item = await transitionCatalogItem(service, itemId, toStatus, user.id, extra)
      return NextResponse.json({ item })
    }

    if (action === 'draw') {
      const item = await rollDraw(service, itemId, user.id)
      return NextResponse.json({ item })
    }

    if (action === 'cancel') {
      const item = await transitionCatalogItem(service, itemId, 'cancelled', user.id)
      return NextResponse.json({ item })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { itemId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  const { data: item } = await service
    .from('auction_catalog_items')
    .select('vendor_id, status, event_id, event:events(coordinator_id)')
    .eq('id', itemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const eventCoordinatorId = resolveEventCoordinatorId(
    item.event as { coordinator_id: string } | { coordinator_id: string }[] | null
  )
  const isCoordinator = eventCoordinatorId === user.id
  const isVendor = item.vendor_id === user.id

  const canVendorRemove =
    isVendor && (item.status === 'draft' || item.status === 'queued') && !isLiveCatalogStatus(item.status)
  const canCoordinatorRemove =
    isCoordinator && REMOVABLE_STATUSES.has(item.status) && !isLiveCatalogStatus(item.status)

  if (!canVendorRemove && !canCoordinatorRemove) {
    return NextResponse.json(
      { error: 'This item cannot be removed while live — cancel it first' },
      { status: 403 }
    )
  }

  await service.from('auction_catalog_items').delete().eq('id', itemId)

  return NextResponse.json({ success: true })
}
