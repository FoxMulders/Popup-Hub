import type { SupabaseClient } from '@supabase/supabase-js'
import { creditsToCents } from '@/lib/quarter-auction/credits'
import type { TransactionType } from '@/types/database'

export async function deductWalletCredits(
  supabase: SupabaseClient,
  userId: string,
  credits: number,
  type: TransactionType,
  metadata: Record<string, unknown>
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const amountCents = creditsToCents(credits)

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', userId)
    .single()

  if (!wallet) {
    return { ok: false, error: 'Wallet not found' }
  }
  if (wallet.balance < amountCents) {
    return { ok: false, error: 'Insufficient quarters' }
  }

  const newBalance = wallet.balance - amountCents
  const { error: walletError } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance)

  if (walletError) {
    return { ok: false, error: 'Could not deduct quarters — please retry' }
  }

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type,
    amount: amountCents,
    metadata,
  })

  return { ok: true, newBalance }
}

export async function nextPaddleNumber(
  supabase: SupabaseClient,
  eventId: string
): Promise<string> {
  const { count } = await supabase
    .from('event_paddles')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  const next = (count ?? 0) + 1
  return String(next).padStart(3, '0')
}
