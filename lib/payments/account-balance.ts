import type { SupabaseClient } from '@supabase/supabase-js'

const INVOICE_THRESHOLD_DOLLARS = 20

export type AddPlatformFeeResult =
  | { ok: true; balanceOwed: number; platformFeeCents: number }
  | { ok: false; error: 'update_failed' }

/**
 * Add platform fee (3% + $1 default) to coordinator account_balances after offline mark-as-paid.
 */
export async function addCoordinatorPlatformFeeToBalance(
  supabase: SupabaseClient,
  params: {
    coordinatorId: string
    platformFeeCents: number
    applicationId: string
    paymentMethod: string
  }
): Promise<AddPlatformFeeResult> {
  const feeCents = Math.max(0, Math.round(params.platformFeeCents))
  const feeDollars = Math.round((feeCents / 100) * 100) / 100

  if (feeDollars === 0) {
    const balance = await getCoordinatorBalanceOwed(supabase, params.coordinatorId)
    return { ok: true, balanceOwed: balance, platformFeeCents: 0 }
  }

  const { data: existing } = await supabase
    .from('account_balances')
    .select('balance_owed')
    .eq('coordinator_id', params.coordinatorId)
    .maybeSingle()

  const previous = Number(existing?.balance_owed ?? 0)
  const next = Math.round((previous + feeDollars) * 100) / 100

  if (existing) {
    const { error } = await supabase
      .from('account_balances')
      .update({ balance_owed: next, updated_at: new Date().toISOString() })
      .eq('coordinator_id', params.coordinatorId)

    if (error) return { ok: false, error: 'update_failed' }
  } else {
    const { error } = await supabase.from('account_balances').insert({
      coordinator_id: params.coordinatorId,
      balance_owed: next,
    })

    if (error) return { ok: false, error: 'update_failed' }
  }

  return { ok: true, balanceOwed: next, platformFeeCents: feeCents }
}

export async function getCoordinatorBalanceOwed(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<number> {
  const { data } = await supabase
    .from('account_balances')
    .select('balance_owed')
    .eq('coordinator_id', coordinatorId)
    .maybeSingle()

  return Number(data?.balance_owed ?? 0)
}

export async function resetCoordinatorBalanceAfterInvoice(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<void> {
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('account_balances')
    .select('coordinator_id')
    .eq('coordinator_id', coordinatorId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('account_balances')
      .update({ balance_owed: 0, last_invoiced_at: now, updated_at: now })
      .eq('coordinator_id', coordinatorId)
  } else {
    await supabase.from('account_balances').insert({
      coordinator_id: coordinatorId,
      balance_owed: 0,
      last_invoiced_at: now,
    })
  }
}

export function isBalanceDueForInvoice(
  balanceOwed: number,
  lastInvoicedAt: string | null,
  now: Date = new Date()
): boolean {
  if (balanceOwed <= 0) return false
  if (balanceOwed > INVOICE_THRESHOLD_DOLLARS) return true

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const isMonthEnd = now.getDate() === lastDay
  if (!isMonthEnd) return false
  if (!lastInvoicedAt) return true

  const last = new Date(lastInvoicedAt)
  return last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()
}

export { INVOICE_THRESHOLD_DOLLARS }
