import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createWalletDeposit } from '@/lib/square/payments'
import { randomUUID } from 'crypto'

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

  const { data: wallet } = await service
    .from('wallets')
    .select('id, balance, square_customer_id, paddle_id')
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
    return NextResponse.json({ error }, { status: 422 })
  }

  // Credit balance
  const newBalance = wallet.balance + amountCents
  await service.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)

  // Assign paddle ID on first deposit
  if (!wallet.paddle_id) {
    const paddleId = Math.floor(1000 + Math.random() * 9000).toString()
    await service.from('wallets').update({ paddle_id: paddleId }).eq('id', wallet.id)
  }

  // Record transaction
  await service.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'deposit',
    amount: amountCents,
    square_payment_id: paymentId,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ success: true, newBalance })
}
