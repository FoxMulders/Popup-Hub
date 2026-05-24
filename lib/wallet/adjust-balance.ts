import type { SupabaseClient } from '@supabase/supabase-js'

export type AdjustBalanceError = 'not_found' | 'insufficient' | 'conflict'

export type AdjustBalanceResult =
  | { ok: true; newBalance: number; walletId: string }
  | { ok: false; error: AdjustBalanceError }

/**
 * Atomically adjust wallet balance using optimistic locking on the current balance.
 */
export async function adjustWalletBalance(
  supabase: SupabaseClient,
  params: { walletId: string; deltaCents: number }
): Promise<AdjustBalanceResult> {
  const { walletId, deltaCents } = params

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('id', walletId)
    .single()

  if (!wallet) {
    return { ok: false, error: 'not_found' }
  }

  const newBalance = wallet.balance + deltaCents
  if (newBalance < 0) {
    return { ok: false, error: 'insufficient' }
  }

  const { data: updated, error } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance)
    .select('balance')
    .maybeSingle()

  if (error || !updated) {
    return { ok: false, error: 'conflict' }
  }

  return { ok: true, newBalance: updated.balance, walletId: wallet.id }
}

export async function adjustWalletBalanceForUser(
  supabase: SupabaseClient,
  userId: string,
  deltaCents: number
): Promise<AdjustBalanceResult> {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!wallet) {
    return { ok: false, error: 'not_found' }
  }

  return adjustWalletBalance(supabase, { walletId: wallet.id, deltaCents })
}

const BALANCE_APPLIED_KEY = 'balance_applied'

export function isDepositBalanceApplied(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[BALANCE_APPLIED_KEY] === true
}

/** Credit a deposit once; marks the transaction row when transactionId is provided. */
export async function applyWalletDepositCredit(
  supabase: SupabaseClient,
  params: {
    walletId: string
    amountCents: number
    transactionId?: string
  }
): Promise<AdjustBalanceResult> {
  const result = await adjustWalletBalance(supabase, {
    walletId: params.walletId,
    deltaCents: params.amountCents,
  })

  if (!result.ok || !params.transactionId) {
    return result
  }

  const { data: tx } = await supabase
    .from('wallet_transactions')
    .select('metadata')
    .eq('id', params.transactionId)
    .single()

  await supabase
    .from('wallet_transactions')
    .update({
      metadata: {
        ...((tx?.metadata as Record<string, unknown> | null) ?? {}),
        balance_applied: true,
      },
    })
    .eq('id', params.transactionId)

  return result
}
