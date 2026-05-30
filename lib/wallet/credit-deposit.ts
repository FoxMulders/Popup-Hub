import type { SupabaseClient } from '@supabase/supabase-js'
import { adjustWalletBalance } from '@/lib/wallet/adjust-balance'
import { assignWalletPaddleIdIfMissing } from '@/lib/wallet/paddle-id'
import type { TransactionType } from '@/types/database'

export interface CreditWalletDepositParams {
  userId: string
  amountCents: number
  metadata: Record<string, unknown>
  transactionType?: TransactionType
}

export async function ensureWallet(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; balance: number; paddle_id: string | null } | null> {
  const { data: existing } = await supabase
    .from('wallets')
    .select('id, balance, paddle_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing

  // Upsert avoids races with handle_new_user() also inserting a wallet row on signup.
  const { data: upserted, error: upsertError } = await supabase
    .from('wallets')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
    .select('id, balance, paddle_id')
    .maybeSingle()

  if (upserted) return upserted

  if (upsertError) {
    const { data: raced } = await supabase
      .from('wallets')
      .select('id, balance, paddle_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (raced) return raced
  }

  return null
}

/** Credit wallet balance, assign paddle on first deposit, and record transaction. */
export async function creditWalletDeposit(
  supabase: SupabaseClient,
  params: CreditWalletDepositParams
): Promise<
  | { ok: true; newBalance: number; walletId: string; transactionId: string }
  | { ok: false; error: string }
> {
  const wallet = await ensureWallet(supabase, params.userId)
  if (!wallet) {
    return { ok: false, error: 'Could not open a wallet for this account. Try again or contact support.' }
  }

  const credit = await adjustWalletBalance(supabase, {
    walletId: wallet.id,
    deltaCents: params.amountCents,
  })

  if (!credit.ok) {
    return { ok: false, error: credit.error }
  }

  await assignWalletPaddleIdIfMissing(supabase, wallet)

  const { data: tx, error: txError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: params.transactionType ?? 'deposit',
      amount: params.amountCents,
      metadata: {
        ...params.metadata,
        user_id: params.userId,
        balance_applied: true,
      },
    })
    .select('id')
    .single()

  if (txError || !tx) {
    await adjustWalletBalance(supabase, {
      walletId: wallet.id,
      deltaCents: -params.amountCents,
    })
    return { ok: false, error: 'Could not record transaction' }
  }

  return {
    ok: true,
    newBalance: credit.newBalance,
    walletId: wallet.id,
    transactionId: tx.id,
  }
}
