import type { SupabaseClient } from '@supabase/supabase-js'
import { creditsToCents } from '@/lib/quarter-auction/credits'
import { deductWalletCredits } from '@/lib/quarter-auction/wallet'
import { assertAuctionParticipant } from '@/lib/quarter-auction/participation'
import { adjustWalletBalance } from '@/lib/wallet/adjust-balance'
import type { AuctionItemEntry } from '@/types/database'

export async function placeCatalogBidEntries(
  supabase: SupabaseClient,
  params: {
    catalogItemId: string
    userId: string
    paddleIds: string[]
    staffId?: string | null
  }
): Promise<
  | { ok: true; entries: AuctionItemEntry[]; newBalance: number }
  | { ok: false; error: string; status: number }
> {
  const { catalogItemId, userId, paddleIds, staffId } = params

  if (!paddleIds.length) {
    return { ok: false, error: 'Select at least one paddle', status: 400 }
  }

  const uniquePaddleIds = [...new Set(paddleIds)]
  if (uniquePaddleIds.length !== paddleIds.length) {
    return { ok: false, error: 'Duplicate paddle selection', status: 400 }
  }

  const { data: item } = await supabase
    .from('auction_catalog_items')
    .select('*')
    .eq('id', catalogItemId)
    .single()

  if (!item) {
    return { ok: false, error: 'Item not found', status: 404 }
  }
  if (item.status !== 'bidding_open') {
    return { ok: false, error: 'Bidding is not open', status: 422 }
  }
  if (!item.entry_cost_credits || item.entry_cost_credits <= 0) {
    return { ok: false, error: 'Entry cost not set', status: 422 }
  }

  const participation = await assertAuctionParticipant(supabase, item.event_id as string, userId)
  if (!participation.ok) {
    return { ok: false, error: participation.error, status: participation.status }
  }

  const { data: paddles } = await supabase
    .from('event_paddles')
    .select('*')
    .eq('event_id', item.event_id)
    .eq('user_id', userId)
    .in('id', uniquePaddleIds)

  if (!paddles || paddles.length !== uniquePaddleIds.length) {
    return { ok: false, error: 'Invalid paddle selection', status: 400 }
  }

  const { data: existing } = await supabase
    .from('auction_item_entries')
    .select('paddle_id')
    .eq('catalog_item_id', catalogItemId)
    .in('paddle_id', uniquePaddleIds)

  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: 'One or more paddles already entered this round',
      status: 422,
    }
  }

  const totalCredits = item.entry_cost_credits * paddles.length
  const totalCents = creditsToCents(totalCredits)

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', userId)
    .single()

  if (!wallet) {
    return { ok: false, error: 'Wallet not found', status: 404 }
  }
  if (wallet.balance < totalCents) {
    return { ok: false, error: 'Insufficient quarters', status: 402 }
  }

  const deduct = await deductWalletCredits(supabase, userId, totalCredits, 'bid_entry', {
    catalog_item_id: catalogItemId,
    event_id: item.event_id,
    paddle_ids: uniquePaddleIds,
    ...(staffId ? { staff_assisted: true, staff_id: staffId } : {}),
  })

  if (!deduct.ok) {
    return { ok: false, error: deduct.error, status: 402 }
  }

  const rows = paddles.map((p) => ({
    catalog_item_id: catalogItemId,
    paddle_id: p.id,
    user_id: userId,
    paddle_number: p.paddle_number,
    credits_spent: item.entry_cost_credits,
  }))

  const { data: entries, error } = await supabase
    .from('auction_item_entries')
    .insert(rows)
    .select('*')

  if (error || !entries?.length) {
    await adjustWalletBalance(supabase, {
      walletId: wallet.id,
      deltaCents: totalCents,
    })
    return {
      ok: false,
      error: error?.message ?? 'Could not record bid — quarters refunded',
      status: 422,
    }
  }

  await supabase
    .from('auction_catalog_items')
    .update({
      pool_credits: (item.pool_credits ?? 0) + totalCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', catalogItemId)

  return { ok: true, entries: entries as AuctionItemEntry[], newBalance: deduct.newBalance }
}
