import type { SupabaseClient } from '@supabase/supabase-js'

interface RefundableDeposit {
  transactionId: string
  paymentId: string
  remainingCents: number
}

/** Square card deposits not yet refunded, in oldest-first order. */
export async function listRefundableCardDeposits(
  supabase: SupabaseClient,
  userId: string
): Promise<RefundableDeposit[]> {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!wallet) return []

  const { data: deposits } = await supabase
    .from('wallet_transactions')
    .select('id, amount, square_payment_id, metadata')
    .eq('wallet_id', wallet.id)
    .eq('type', 'deposit')
    .not('square_payment_id', 'is', null)
    .order('created_at', { ascending: true })

  if (!deposits?.length) return []

  const { data: refunds } = await supabase
    .from('wallet_transactions')
    .select('metadata')
    .eq('wallet_id', wallet.id)
    .in('type', ['withdrawal', 'refund'])

  const refundedByPayment = new Map<string, number>()
  for (const row of refunds ?? []) {
    const meta = row.metadata as Record<string, unknown> | null
    const paymentId = meta?.square_payment_id as string | undefined
    const refunded = meta?.refunded_cents as number | undefined
    if (paymentId && refunded) {
      refundedByPayment.set(paymentId, (refundedByPayment.get(paymentId) ?? 0) + refunded)
    }
  }

  const refundable: RefundableDeposit[] = []
  for (const deposit of deposits) {
    const paymentId = deposit.square_payment_id as string
    const alreadyRefunded = refundedByPayment.get(paymentId) ?? 0
    const remaining = deposit.amount - alreadyRefunded
    if (remaining > 0) {
      refundable.push({
        transactionId: deposit.id,
        paymentId,
        remainingCents: remaining,
      })
    }
  }

  return refundable
}

export async function getRefundableCardBalanceCents(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const deposits = await listRefundableCardDeposits(supabase, userId)
  return deposits.reduce((sum, row) => sum + row.remainingCents, 0)
}

export async function getAvailableReclaimBalanceCents(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()

  return Math.max(0, wallet?.balance ?? 0)
}
