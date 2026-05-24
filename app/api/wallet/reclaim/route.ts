import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  getAvailableReclaimBalanceCents,
  getRefundableCardBalanceCents,
} from '@/lib/wallet/refundable-card-balance'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [{ data: wallet }, availableCents, refundableCardCents, { data: pending }] =
    await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
      getAvailableReclaimBalanceCents(admin, user.id),
      getRefundableCardBalanceCents(admin, user.id),
      supabase
        .from('wallet_withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

  const balance = wallet?.balance ?? 0
  const cardReclaimCents = Math.min(availableCents, refundableCardCents)

  return NextResponse.json({
    balanceCents: balance,
    availableCents,
    cardReclaimCents,
    pending: pending ?? [],
  })
}
