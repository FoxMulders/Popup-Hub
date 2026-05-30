import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { debitWalletWithdrawal } from '@/lib/wallet/debit-withdrawal'
import { adjustWalletBalanceForUser } from '@/lib/wallet/adjust-balance'
import { ensureWallet } from '@/lib/wallet/credit-deposit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    shopperUserId?: string
    qrPayload?: string
    amountCents?: number
    eventId?: string
  }

  const shopperUserId =
    body.shopperUserId?.trim() ||
    (body.qrPayload ? parseWalletTopUpQrPayload(body.qrPayload) : null)

  if (!shopperUserId) {
    return NextResponse.json({ error: 'Invalid patron QR or user ID' }, { status: 400 })
  }

  const amountCents = body.amountCents
  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Minimum cash payout is $1.00' }, { status: 400 })
  }

  if (body.eventId) {
    const { data: event } = await supabase
      .from('events')
      .select('coordinator_id')
      .eq('id', body.eventId)
      .single()

    if (!event || event.coordinator_id !== user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
  }

  const admin = createAdminClient()

  const { data: shopper } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', shopperUserId)
    .single()

  if (!shopper) {
    return NextResponse.json({ error: 'Patron account not found' }, { status: 404 })
  }

  const wallet = await ensureWallet(admin, shopperUserId)
  if (!wallet) {
    return NextResponse.json(
      { error: 'Could not open a wallet for this patron. Try again or contact support.' },
      { status: 500 }
    )
  }

  if (wallet.balance < amountCents) {
    return NextResponse.json(
      {
        error: `Insufficient wallet balance (${(wallet.balance / 100).toFixed(2)} available)`,
      },
      { status: 422 }
    )
  }

  const debit = await debitWalletWithdrawal(admin, {
    userId: shopperUserId,
    amountCents,
    metadata: {
      method: 'cash_at_door_reclaim',
      staff_id: user.id,
      event_id: body.eventId ?? null,
    },
  })

  if (!debit.ok) {
    return NextResponse.json({ error: debit.error }, { status: 422 })
  }

  const { data: row, error: insertError } = await admin
    .from('wallet_withdrawal_requests')
    .insert({
      user_id: shopperUserId,
      amount_cents: amountCents,
      method: 'cash_at_door',
      status: 'completed',
      event_id: body.eventId ?? null,
      confirmed_by: user.id,
      wallet_transaction_id: debit.transactionId,
      completed_at: new Date().toISOString(),
      metadata: { staff_id: user.id },
    })
    .select('id')
    .single()

  if (insertError) {
    await adjustWalletBalanceForUser(admin, shopperUserId, amountCents)
    return NextResponse.json({ error: 'Could not record cash payout' }, { status: 500 })
  }

  await admin.from('notifications').insert({
    user_id: shopperUserId,
    type: 'payment_received',
    message: `💵 $${(amountCents / 100).toFixed(2)} was returned to you in cash from your wallet.`,
    metadata: {
      amount_cents: amountCents,
      method: 'cash_at_door_reclaim',
      withdrawal_request_id: row?.id,
      event_id: body.eventId ?? null,
    },
  })

  return NextResponse.json({
    success: true,
    newBalance: debit.newBalance,
    shopper: { id: shopper.id, full_name: shopper.full_name, email: shopper.email },
  })
}
