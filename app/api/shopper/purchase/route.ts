import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Record a shopper purchase at a vendor booth (atomic wallet debit via RPC). */
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

  const { data, error } = await supabase.rpc('record_shopper_purchase', {
    p_vendor_id: vendor_id,
    p_amount_cents: amount_cents,
    p_event_id: event_id ?? null,
    p_description: description ?? null,
    p_square_payment_id: square_payment_id ?? null,
  })

  if (error) {
    const message = error.message ?? 'Payment failed'
    if (/insufficient balance/i.test(message)) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 })
    }
    if (/not authenticated/i.test(message)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (/wallet not found/i.test(message)) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }
    if (/invalid (amount|vendor)/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[shopper/purchase] RPC failed', error)
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 })
  }

  const result = data as { purchase_id?: string; balance?: number } | null
  return NextResponse.json({
    purchase_id: result?.purchase_id,
    balance: result?.balance,
  })
}
