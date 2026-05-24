import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refundSquarePayment } from '@/lib/square/refunds'
import {
  getAvailableReclaimBalanceCents,
  getRefundableCardBalanceCents,
  listRefundableCardDeposits,
} from '@/lib/wallet/refundable-card-balance'
import { debitWalletWithdrawal } from '@/lib/wallet/debit-withdrawal'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { amountCents?: number; eventId?: string }
  const amountCents = body.amountCents

  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Minimum card refund is $1.00' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [available, refundableCard] = await Promise.all([
    getAvailableReclaimBalanceCents(admin, user.id),
    getRefundableCardBalanceCents(admin, user.id),
  ])

  const maxRefund = Math.min(available, refundableCard)
  if (amountCents > maxRefund) {
    return NextResponse.json(
      {
        error:
          maxRefund <= 0
            ? 'No card-funded balance is available to refund.'
            : `You can refund up to $${(maxRefund / 100).toFixed(2)} to your card.`,
      },
      { status: 422 }
    )
  }

  const deposits = await listRefundableCardDeposits(admin, user.id)
  let remaining = amountCents
  const refundPlan: { paymentId: string; amountCents: number }[] = []

  for (const deposit of deposits) {
    if (remaining <= 0) break
    const slice = Math.min(remaining, deposit.remainingCents)
    refundPlan.push({ paymentId: deposit.paymentId, amountCents: slice })
    remaining -= slice
  }

  if (remaining > 0) {
    return NextResponse.json({ error: 'Could not allocate card refund' }, { status: 422 })
  }

  const refundIds: string[] = []
  for (const slice of refundPlan) {
    const { refundId, error } = await refundSquarePayment({
      paymentId: slice.paymentId,
      amountCents: slice.amountCents,
      reason: 'Wallet balance reclaim at event end',
    })
    if (error || !refundId) {
      return NextResponse.json(
        { error: error ?? 'Card refund failed — contact event staff for cash or e-transfer.' },
        { status: 422 }
      )
    }
    refundIds.push(refundId)
  }

  const debit = await debitWalletWithdrawal(admin, {
    userId: user.id,
    amountCents,
    metadata: {
      method: 'card_refund',
      square_refund_ids: refundIds,
      refund_plan: refundPlan,
      event_id: body.eventId ?? null,
    },
  })

  if (!debit.ok) {
    return NextResponse.json(
      {
        error:
          'Square refund succeeded but wallet update failed — contact support with your refund confirmation.',
      },
      { status: 500 }
    )
  }

  for (const slice of refundPlan) {
    await admin.from('wallet_transactions').insert({
      wallet_id: debit.walletId,
      type: 'refund',
      amount: 0,
      metadata: {
        square_payment_id: slice.paymentId,
        refunded_cents: slice.amountCents,
        card_refund_tracking: true,
      },
    })
  }

  await admin.from('wallet_withdrawal_requests').insert({
    user_id: user.id,
    amount_cents: amountCents,
    method: 'card_refund',
    status: 'completed',
    wallet_transaction_id: debit.transactionId,
    square_refund_id: refundIds[0] ?? null,
    event_id: body.eventId ?? null,
    completed_at: new Date().toISOString(),
    metadata: { square_refund_ids: refundIds },
  })

  await admin.from('notifications').insert({
    user_id: user.id,
    type: 'payment_received',
    message: `💳 $${(amountCents / 100).toFixed(2)} was refunded to your card from your wallet.`,
    metadata: { amount_cents: amountCents, method: 'card_refund' },
  })

  return NextResponse.json({ success: true, newBalance: debit.newBalance })
}
