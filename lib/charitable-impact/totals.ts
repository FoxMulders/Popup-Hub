import type { SupabaseClient } from '@supabase/supabase-js'
import { creditsToCents } from '@/lib/quarter-auction/credits'
import {
  computeCharityImpactProgress,
  parseCharityMilestones,
  type CharityImpactProgress,
  type CharityMilestone,
} from '@/lib/charitable-impact/milestones'

export interface CharitableImpactSnapshot {
  eventId: string
  totalCents: number
  milestones: CharityMilestone[]
  progress: CharityImpactProgress
}

/** Sum bid pools and virtual paddle sales for the charity quarter auction. */
export async function computeCharitableTotalCents(
  supabase: SupabaseClient,
  eventId: string
): Promise<number> {
  const [{ data: items }, { data: paddles }] = await Promise.all([
    supabase.from('auction_catalog_items').select('pool_credits').eq('event_id', eventId),
    supabase.from('event_paddles').select('purchase_credits').eq('event_id', eventId),
  ])

  const poolCredits =
    items?.reduce((sum, row) => sum + (row.pool_credits ?? 0), 0) ?? 0
  const paddleCredits =
    paddles?.reduce((sum, row) => sum + (row.purchase_credits ?? 0), 0) ?? 0

  return creditsToCents(poolCredits + paddleCredits)
}

export async function getCharitableImpactSnapshot(
  supabase: SupabaseClient,
  eventId: string
): Promise<CharitableImpactSnapshot> {
  const totalCents = await computeCharitableTotalCents(supabase, eventId)

  const { data: settings } = await supabase
    .from('quarter_auction_settings')
    .select('charity_milestones')
    .eq('event_id', eventId)
    .maybeSingle()

  const milestones = parseCharityMilestones(settings?.charity_milestones)
  const progress = computeCharityImpactProgress(totalCents, milestones)

  return {
    eventId,
    totalCents,
    milestones,
    progress,
  }
}

/** Derive total cents locally from catalog items + paddle list (for optimistic realtime). */
export function computeTotalCentsFromLiveData(input: {
  poolCreditsByItem: number[]
  paddlePurchaseCredits: number[]
}): number {
  const poolCredits = input.poolCreditsByItem.reduce((s, n) => s + n, 0)
  const paddleCredits = input.paddlePurchaseCredits.reduce((s, n) => s + n, 0)
  return creditsToCents(poolCredits + paddleCredits)
}
