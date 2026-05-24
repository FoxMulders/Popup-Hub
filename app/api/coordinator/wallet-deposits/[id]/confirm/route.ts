import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditWalletDeposit } from '@/lib/wallet/credit-deposit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: requestId } = await params
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

  const service = await createServiceClient()

  const { data: depositRequest } = await service
    .from('wallet_deposit_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!depositRequest) {
    return NextResponse.json({ error: 'Deposit request not found' }, { status: 404 })
  }

  if (depositRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Deposit request is not pending' }, { status: 422 })
  }

  if (depositRequest.method !== 'etransfer') {
    return NextResponse.json({ error: 'Not an e-transfer request' }, { status: 400 })
  }

  if (depositRequest.expires_at && new Date(depositRequest.expires_at) < new Date()) {
    await service
      .from('wallet_deposit_requests')
      .update({ status: 'expired' })
      .eq('id', requestId)
    return NextResponse.json({ error: 'Deposit request has expired' }, { status: 422 })
  }

  const credit = await creditWalletDeposit(service, {
    userId: depositRequest.user_id,
    amountCents: depositRequest.amount_cents,
    metadata: {
      method: 'etransfer',
      reference_code: depositRequest.reference_code,
      deposit_request_id: depositRequest.id,
      confirmed_by: user.id,
      event_id: depositRequest.event_id,
    },
  })

  if (!credit.ok) {
    return NextResponse.json({ error: credit.error }, { status: 422 })
  }

  await service
    .from('wallet_deposit_requests')
    .update({
      status: 'completed',
      confirmed_by: user.id,
      wallet_transaction_id: credit.transactionId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  await service.from('notifications').insert({
    user_id: depositRequest.user_id,
    type: 'payment_received',
    message: `✅ Your e-transfer wallet top-up of $${(depositRequest.amount_cents / 100).toFixed(2)} was confirmed.`,
    metadata: {
      amount_cents: depositRequest.amount_cents,
      method: 'etransfer',
      deposit_request_id: depositRequest.id,
    },
  })

  return NextResponse.json({ success: true, newBalance: credit.newBalance })
}
