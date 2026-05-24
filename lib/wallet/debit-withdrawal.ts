import type { SupabaseClient } from '@supabase/supabase-js'
import { adjustWalletBalanceForUser } from '@/lib/wallet/adjust-balance'

export interface DebitWalletWithdrawalParams {
  userId: string
  amountCents: number
  metadata: Record<string, unknown>
}

/** Debit wallet balance and record a withdrawal transaction. */
export async function debitWalletWithdrawal(
  supabase: SupabaseClient,
  params: DebitWalletWithdrawalParams
): Promise<
  | { ok: true; newBalance: number; walletId: string; transactionId: string }
  | { ok: false; error: string }
> {
  const debit = await adjustWalletBalanceForUser(supabase, params.userId, -params.amountCents)

  if (!debit.ok) {
    if (debit.error === 'insufficient') {
      return { ok: false, error: 'Insufficient wallet balance' }
    }
    if (debit.error === 'not_found') {
      return { ok: false, error: 'Wallet not found' }
    }
    return { ok: false, error: 'Could not update wallet balance' }
  }

  const { data: tx, error: txError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: debit.walletId,
      type: 'withdrawal',
      amount: -params.amountCents,
      metadata: {
        ...params.metadata,
        user_id: params.userId,
        balance_applied: true,
      },
    })
    .select('id')
    .single()

  if (txError || !tx) {
    await adjustWalletBalanceForUser(supabase, params.userId, params.amountCents)
    return { ok: false, error: 'Could not record withdrawal' }
  }

  return {
    ok: true,
    newBalance: debit.newBalance,
    walletId: debit.walletId,
    transactionId: tx.id,
  }
}

/** Restore wallet balance when a pending reclaim is cancelled or expires. */
export async function creditWalletWithdrawalReversal(
  supabase: SupabaseClient,
  params: {
    userId: string
    amountCents: number
    withdrawalRequestId: string
    reason: 'cancelled' | 'expired'
  }
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { creditWalletDeposit } = await import('@/lib/wallet/credit-deposit')

  const credit = await creditWalletDeposit(supabase, {
    userId: params.userId,
    amountCents: params.amountCents,
    transactionType: 'refund',
    metadata: {
      method: 'reclaim_reversal',
      withdrawal_request_id: params.withdrawalRequestId,
      reason: params.reason,
    },
  })

  if (!credit.ok) {
    return { ok: false, error: credit.error }
  }

  return { ok: true, newBalance: credit.newBalance }
}
