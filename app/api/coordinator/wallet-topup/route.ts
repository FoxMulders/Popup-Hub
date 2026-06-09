import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { creditWalletDeposit } from '@/lib/wallet/credit-deposit'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'

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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
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
    return NextResponse.json({ error: 'Minimum cash top-up is $1.00' }, { status: 400 })
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

  const service = createAdminClient()

  const { data: shopper } = await service
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', shopperUserId)
    .single()

  if (!shopper) {
    return NextResponse.json({ error: 'Patron account not found' }, { status: 404 })
  }

  const credit = await creditWalletDeposit(service, {
    userId: shopperUserId,
    amountCents,
    metadata: {
      method: 'cash_at_door',
      staff_id: user.id,
      event_id: body.eventId ?? null,
    },
  })

  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: 422 })
  }

  await service.from('wallet_deposit_requests').insert({
    user_id: shopperUserId,
    amount_cents: amountCents,
    method: 'cash_at_door',
    status: 'completed',
    event_id: body.eventId ?? null,
    confirmed_by: user.id,
    wallet_transaction_id: credit.transactionId,
    completed_at: new Date().toISOString(),
    metadata: { staff_id: user.id },
  })

  await service.from('notifications').insert({
    user_id: shopperUserId,
    type: 'payment_received',
    message: `💰 ${(amountCents / 100).toFixed(2)} was added to your wallet at the door.`,
    metadata: {
      amount_cents: amountCents,
      method: 'cash_at_door',
      event_id: body.eventId ?? null,
    },
  })

  return NextResponse.json({
    success: true,
    newBalance: credit.newBalance,
    shopper: { id: shopper.id, full_name: shopper.full_name, email: shopper.email },
  })
}
