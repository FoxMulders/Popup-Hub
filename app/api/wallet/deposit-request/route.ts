import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateEtransferReferenceCode, etransferHoldExpiresAt } from '@/lib/applications/etransfer-reference'
import { getWalletEtransferEmail } from '@/lib/wallet/etransfer-config'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { amountCents?: number; eventId?: string }
  const amountCents = body.amountCents
  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Minimum top-up is $1.00' }, { status: 400 })
  }

  const paymentEmail = getWalletEtransferEmail()
  if (!paymentEmail) {
    return NextResponse.json(
      { error: 'E-transfer wallet top-up is not configured. Use cash at the door or card payment.' },
      { status: 503 }
    )
  }

  const service = await createServiceClient()

  const { data: existingPending } = await service
    .from('wallet_deposit_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('method', 'etransfer')
    .eq('status', 'pending')
    .limit(1)

  if (existingPending && existingPending.length > 0) {
    return NextResponse.json(
      { error: 'You already have a pending e-transfer top-up. Complete or wait for it to expire before starting another.' },
      { status: 422 }
    )
  }

  const referenceCode = generateEtransferReferenceCode()
  const expiresAt = etransferHoldExpiresAt()

  const { data: row, error } = await service
    .from('wallet_deposit_requests')
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      method: 'etransfer',
      status: 'pending',
      reference_code: referenceCode,
      event_id: body.eventId ?? null,
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Could not create deposit request' }, { status: 500 })
  }

  return NextResponse.json({
    request: row,
    paymentEmail,
    referenceCode,
    expiresAt,
  })
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
    .from('wallet_deposit_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return NextResponse.json({
    pending: pending ?? [],
    paymentEmail: getWalletEtransferEmail(),
  })
}
