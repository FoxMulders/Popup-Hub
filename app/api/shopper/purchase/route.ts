import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adjustWalletBalanceForUser } from '@/lib/wallet/adjust-balance'

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

  const debit = await adjustWalletBalanceForUser(supabase, user.id, -amount_cents)

  if (!debit.ok) {
    if (debit.error === 'insufficient') {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 })
    }
    if (debit.error === 'not_found') {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Payment failed — please retry' }, { status: 409 })
  }

  await supabase.from('wallet_transactions').insert({
    wallet_id: debit.walletId,
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
    const refund = await adjustWalletBalanceForUser(supabase, user.id, amount_cents)
    if (!refund.ok) {
      console.error('[shopper/purchase] purchase insert failed and refund failed', {
        userId: user.id,
        amount_cents,
        purchaseError,
        refundError: refund.error,
      })
    }
    return NextResponse.json({ error: 'Could not record purchase' }, { status: 500 })
  }

  return NextResponse.json({ purchase_id: purchase.id, balance: debit.newBalance })
}
