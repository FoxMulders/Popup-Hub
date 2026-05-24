import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'
import { canTransition } from '@/lib/quarter-auction/state-machine'
import { drawWinnerFromEntries } from '@/lib/quarter-auction/draw'
import { notifyQuarterAuctionWinner } from '@/lib/quarter-auction/notify-winner'
import { notifyQuarterAuctionBiddingOpen } from '@/lib/quarter-auction/notify-bidding-open'
import type { AuctionItemStatus } from '@/types/database'

export async function getOrCreateSettings(
  supabase: SupabaseClient,
  eventId: string
): Promise<QuarterAuctionSettings> {
  const { data: existing } = await supabase
    .from('quarter_auction_settings')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing) return existing as QuarterAuctionSettings

  const { data: created, error } = await supabase
    .from('quarter_auction_settings')
    .insert({ event_id: eventId })
    .select('*')
    .single()

  if (error || !created) {
    throw new Error('Could not initialize quarter auction settings')
  }
  return created as QuarterAuctionSettings
}

export async function getActiveCatalogItem(
  supabase: SupabaseClient,
  eventId: string
): Promise<AuctionCatalogItem | null> {
  const { data } = await supabase
    .from('auction_catalog_items')
    .select('*')
    .eq('event_id', eventId)
    .in('status', [
      'active_price_setting',
      'bidding_open',
      'bidding_closed',
      'drawing',
    ])
    .order('queue_position', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as AuctionCatalogItem | null) ?? null
}

export async function transitionCatalogItem(
  supabase: SupabaseClient,
  itemId: string,
  toStatus: AuctionItemStatus,
  coordinatorId: string,
  extra?: Partial<AuctionCatalogItem>
): Promise<AuctionCatalogItem> {
  const { data: item } = await supabase
    .from('auction_catalog_items')
    .select('*, event:events(coordinator_id)')
    .eq('id', itemId)
    .single()

  if (!item) throw new Error('Item not found')

  const event = item.event as { coordinator_id: string } | null
  if (event?.coordinator_id !== coordinatorId) {
    throw new Error('Not authorized')
  }

  const fromStatus = item.status as AuctionItemStatus
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`Cannot move from ${fromStatus} to ${toStatus}`)
  }

  if (toStatus === 'active_price_setting') {
    const { data: otherLive } = await supabase
      .from('auction_catalog_items')
      .select('id')
      .eq('event_id', item.event_id)
      .in('status', ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'])
      .neq('id', itemId)
      .limit(1)

    if (otherLive && otherLive.length > 0) {
      throw new Error('Another item is still live — complete it first')
    }
  }

  const patch: Record<string, unknown> = {
    status: toStatus,
    updated_at: new Date().toISOString(),
    ...extra,
  }

  if (toStatus === 'bidding_open') patch.bidding_opened_at = new Date().toISOString()
  if (toStatus === 'bidding_closed') patch.bidding_closed_at = new Date().toISOString()
  if (toStatus === 'completed') patch.completed_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('auction_catalog_items')
    .update(patch)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error || !updated) throw new Error('Transition failed')

  if (toStatus === 'bidding_open') {
    const entryCredits =
      (updated as AuctionCatalogItem).entry_cost_credits ??
      extra?.entry_cost_credits ??
      1
    await notifyQuarterAuctionBiddingOpen(supabase, {
      catalogItemId: itemId,
      itemTitle: (updated as AuctionCatalogItem).title,
      eventId: item.event_id as string,
      entryCostCredits: entryCredits,
    })
  }

  return updated as AuctionCatalogItem
}

export async function rollDraw(
  supabase: SupabaseClient,
  itemId: string,
  coordinatorId: string
): Promise<AuctionCatalogItem> {
  const { data: item } = await supabase
    .from('auction_catalog_items')
    .select('*, event:events(coordinator_id)')
    .eq('id', itemId)
    .single()

  if (!item) throw new Error('Item not found')
  const event = item.event as { coordinator_id: string } | null
  if (event?.coordinator_id !== coordinatorId) throw new Error('Not authorized')
  if (item.status !== 'bidding_closed') {
    throw new Error('Close bidding before rolling the draw')
  }

  await supabase
    .from('auction_catalog_items')
    .update({ status: 'drawing', updated_at: new Date().toISOString() })
    .eq('id', itemId)

  const { data: entries } = await supabase
    .from('auction_item_entries')
    .select('*')
    .eq('catalog_item_id', itemId)

  const result = drawWinnerFromEntries(entries ?? [])
  const poolCredits = result?.poolCredits ?? 0

  const { data: completed, error } = await supabase
    .from('auction_catalog_items')
    .update({
      status: 'completed',
      pool_credits: poolCredits,
      winning_paddle_number: result?.winningPaddleNumber ?? null,
      winner_user_id: result?.winnerUserId ?? null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select('*')
    .single()

  if (error || !completed) throw new Error('Draw failed')

  if (completed.winner_user_id && completed.winning_paddle_number) {
    await notifyQuarterAuctionWinner(supabase, completed as AuctionCatalogItem)
  }

  return completed as AuctionCatalogItem
}
