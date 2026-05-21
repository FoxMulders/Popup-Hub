import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createWalletDeposit } from '@/lib/square/payments'

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

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, square_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  }

  const { paymentId, error } = await createWalletDeposit({
    sourceId,
    amountCents,
    userId: user.id,
    squareCustomerId: wallet.square_customer_id ?? undefined,
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
