import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateEtransferReferenceCode, etransferHoldExpiresAt } from '@/lib/applications/etransfer-reference'
import { getAvailableReclaimBalanceCents } from '@/lib/wallet/refundable-card-balance'
import { debitWalletWithdrawal, creditWalletWithdrawalReversal } from '@/lib/wallet/debit-withdrawal'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    amountCents?: number
    payoutEmail?: string
    eventId?: string
  }

  const amountCents = body.amountCents
  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Minimum reclaim is $1.00' }, { status: 400 })
  }

  const payoutEmail = body.payoutEmail?.trim() || user.email
  if (!payoutEmail) {
    return NextResponse.json({ error: 'Payout email is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const available = await getAvailableReclaimBalanceCents(admin, user.id)
  if (amountCents > available) {
    return NextResponse.json(
      { error: `Only ${(available / 100).toFixed(2)} is available to reclaim right now.` },
      { status: 422 }
    )
  }

  const { data: existingPending } = await admin
    .from('wallet_withdrawal_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('method', 'etransfer')
    .eq('status', 'pending')
    .limit(1)

  if (existingPending && existingPending.length > 0) {
    return NextResponse.json(
      { error: 'You already have a pending e-transfer reclaim. Cancel it before starting another.' },
      { status: 422 }
    )
  }

  const referenceCode = generateEtransferReferenceCode()
  const expiresAt = etransferHoldExpiresAt()

  const debit = await debitWalletWithdrawal(admin, {
    userId: user.id,
    amountCents,
    metadata: {
      method: 'etransfer_reclaim',
      status: 'pending',
      payout_email: payoutEmail,
      reference_code: referenceCode,
      event_id: body.eventId ?? null,
    },
  })

  if (!debit.ok) {
    return NextResponse.json({ error: debit.error }, { status: 422 })
  }

  const { data: row, error } = await admin
    .from('wallet_withdrawal_requests')
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      method: 'etransfer',
      status: 'pending',
      payout_email: payoutEmail,
      reference_code: referenceCode,
      event_id: body.eventId ?? null,
      wallet_transaction_id: debit.transactionId,
      expires_at: expiresAt,
      metadata: { reserved_at: new Date().toISOString() },
    })
    .select('*')
    .single()

  if (error || !row) {
    await creditWalletWithdrawalReversal(admin, {
      userId: user.id,
      amountCents,
      withdrawalRequestId: 'failed-insert',
      reason: 'cancelled',
    })
    return NextResponse.json({ error: 'Could not create reclaim request' }, { status: 500 })
  }

  return NextResponse.json({ request: row, referenceCode, expiresAt })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pending } = await supabase
    .from('wallet_withdrawal_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return NextResponse.json({ pending: pending ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('id')
  if (!requestId) {
    return NextResponse.json({ error: 'Request id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('wallet_withdrawal_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!row) {
    return NextResponse.json({ error: 'Pending reclaim not found' }, { status: 404 })
  }

  const reversal = await creditWalletWithdrawalReversal(admin, {
    userId: user.id,
    amountCents: row.amount_cents,
    withdrawalRequestId: row.id,
    reason: 'cancelled',
  })

  if (!reversal.ok) {
    return NextResponse.json({ error: reversal.error }, { status: 422 })
  }

  await admin
    .from('wallet_withdrawal_requests')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', row.id)

  return NextResponse.json({ success: true, newBalance: reversal.newBalance })
}
