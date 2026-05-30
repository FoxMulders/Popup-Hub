import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createWalletDeposit } from '@/lib/square/payments'
import { ensureWallet } from '@/lib/wallet/credit-deposit'

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sourceId, amountCents } = await request.json()

  if (!sourceId || !amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Minimum deposit is $1.00' }, { status: 400 })
  }

  const wallet = await ensureWallet(supabase, user.id)
  if (!wallet) {
    return NextResponse.json(
      { error: 'Could not open your wallet. Please try again or contact support.' },
      { status: 500 }
    )
  }

  const { data: walletRow } = await supabase
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

  if (error) {
    return NextResponse.json({ error }, { status: 402 })
  }

  // Record pending transaction — balance updated by webhook on payment.completed
  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'deposit',
    amount: amountCents,
    square_payment_id: paymentId,
    metadata: { userId: user.id },
  })

  return NextResponse.json({ paymentId, amountCents })
}
