import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: withdrawalRequest } = await admin
    .from('wallet_withdrawal_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!withdrawalRequest) {
    return NextResponse.json({ error: 'Reclaim request not found' }, { status: 404 })
  }

  if (withdrawalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Reclaim request is not pending' }, { status: 422 })
  }

  if (withdrawalRequest.method !== 'etransfer') {
    return NextResponse.json({ error: 'Not an e-transfer reclaim request' }, { status: 400 })
  }

  if (withdrawalRequest.expires_at && new Date(withdrawalRequest.expires_at) < new Date()) {
    const { creditWalletWithdrawalReversal } = await import('@/lib/wallet/debit-withdrawal')
    await creditWalletWithdrawalReversal(admin, {
      userId: withdrawalRequest.user_id,
      amountCents: withdrawalRequest.amount_cents,
      withdrawalRequestId: withdrawalRequest.id,
      reason: 'expired',
    })
    await admin
      .from('wallet_withdrawal_requests')
      .update({ status: 'expired', completed_at: new Date().toISOString() })
      .eq('id', requestId)
    return NextResponse.json({ error: 'Reclaim request has expired' }, { status: 422 })
  }

  await admin
    .from('wallet_withdrawal_requests')
    .update({
      status: 'completed',
      confirmed_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  await admin.from('notifications').insert({
    user_id: withdrawalRequest.user_id,
    type: 'payment_received',
    message: `✅ Your e-transfer reclaim of $${(withdrawalRequest.amount_cents / 100).toFixed(2)} was sent to ${withdrawalRequest.payout_email ?? 'your email'}.`,
    metadata: {
      amount_cents: withdrawalRequest.amount_cents,
      method: 'etransfer_reclaim',
      withdrawal_request_id: withdrawalRequest.id,
    },
  })

  return NextResponse.json({ success: true })
}
