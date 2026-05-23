import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Record a shopper purchase at a vendor booth (wallet debit). V2 unified checkout. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    vendor_id?: string
    event_id?: string
    amount_cents?: number
    description?: string
    square_payment_id?: string
  }

  const { vendor_id, event_id, amount_cents, description, square_payment_id } = body
  if (!vendor_id || !amount_cents || amount_cents < 1) {
    return NextResponse.json({ error: 'Invalid purchase data' }, { status: 400 })
  }

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!wallet || wallet.balance < amount_cents) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 })
  }

  const newBalance = wallet.balance - amount_cents

  const { error: walletError } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)

  if (walletError) {
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 })
  }

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'withdrawal',
    amount: amount_cents,
    square_payment_id: square_payment_id ?? null,
    metadata: { vendor_id, event_id, description },
  })

  const { data: purchase, error: purchaseError } = await supabase
    .from('shopper_purchases')
    .insert({
      shopper_id: user.id,
      vendor_id,
      event_id: event_id ?? null,
      amount_cents,
      description: description ?? null,
      square_payment_id: square_payment_id ?? null,
    })
    .select('id')
    .single()

  if (purchaseError) {
    return NextResponse.json({ error: 'Could not record purchase' }, { status: 500 })
  }

  return NextResponse.json({ purchase_id: purchase.id, balance: newBalance })
}
