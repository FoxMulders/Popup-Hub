import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createWalletDeposit } from '@/lib/square/payments'
import { applyWalletDepositCredit } from '@/lib/wallet/adjust-balance'
import { ensureWallet } from '@/lib/wallet/credit-deposit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sourceId, amountCents } = await request.json()

  if (!sourceId || typeof amountCents !== 'number' || amountCents < 100) {
    return NextResponse.json({ error: 'Invalid deposit parameters' }, { status: 400 })
  }

  const service = await createServiceClient()

  const wallet = await ensureWallet(service, user.id)
  if (!wallet) {
    return NextResponse.json(
      { error: 'Could not open your wallet. Please try again or contact support.' },
      { status: 500 }
    )
  }

  const { data: walletRow } = await service
    .from('wallets')
    .select('square_customer_id')
    .eq('id', wallet.id)
    .single()

  const { paymentId, error } = await createWalletDeposit({
    sourceId,
    amountCents,
    userId: user.id,
    squareCustomerId: walletRow?.square_customer_id ?? undefined,
  })

  if (error || !paymentId) {
    return NextResponse.json({ error: error ?? 'Payment failed' }, { status: 422 })
  }

  const { data: transaction, error: txError } = await service
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'deposit',
      amount: amountCents,
      square_payment_id: paymentId,
      metadata: { user_id: user.id, balance_applied: false },
    })
    .select('id')
    .single()

  if (txError || !transaction) {
    return NextResponse.json({ error: 'Could not record deposit' }, { status: 500 })
  }

  const credit = await applyWalletDepositCredit(service, {
    walletId: wallet.id,
    amountCents,
    transactionId: transaction.id,
  })

  if (!credit.ok) {
    return NextResponse.json(
      { error: 'Balance update conflict — your payment was received; balance will sync shortly.' },
      { status: 409 }
    )
  }

  if (!wallet.paddle_id) {
    const paddleId = Math.floor(1000 + Math.random() * 9000).toString()
    await service.from('wallets').update({ paddle_id: paddleId }).eq('id', wallet.id)
  }

  return NextResponse.json({ success: true, newBalance: credit.newBalance })
}
