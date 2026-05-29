import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile }, { data: wallet }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'role, etransfer_payment_email, offline_payment_instructions, stripe_connected_id, stripe_onboarding_complete, platform_wallet_blocked, platform_wallet_grace_until, payout_account_id, square_access_token, payout_onboarding_status'
      )
      .eq('id', user.id)
      .single(),
    supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
  ])

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const { data: connectedEvent } = await supabase
    .from('events')
    .select('square_merchant_id, accepts_square, accepts_stripe, accepts_offline_etransfer, accepts_offline_cash')
    .eq('coordinator_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const squareConnected =
    !!connectedEvent?.square_merchant_id ||
    (!!profile.square_access_token && profile.payout_onboarding_status === 'complete')

  return NextResponse.json({
    walletBalanceCents: wallet?.balance ?? 0,
    walletBlocked: profile.platform_wallet_blocked === true,
    walletGraceUntil: profile.platform_wallet_grace_until,
    etransferPaymentEmail: profile.etransfer_payment_email,
    offlinePaymentInstructions: profile.offline_payment_instructions,
    squareConnected,
    stripeConnected: !!profile.stripe_connected_id,
    stripeOnboardingComplete: profile.stripe_onboarding_complete === true,
    defaultEventPaymentFlags: {
      accepts_square: connectedEvent?.accepts_square ?? true,
      accepts_stripe: connectedEvent?.accepts_stripe ?? false,
      accepts_offline_etransfer: connectedEvent?.accepts_offline_etransfer ?? true,
      accepts_offline_cash: connectedEvent?.accepts_offline_cash ?? false,
    },
  })
}

export async function PATCH(request: Request) {
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
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    etransferPaymentEmail?: string | null
    offlinePaymentInstructions?: string | null
    defaultEventPaymentFlags?: {
      accepts_square?: boolean
      accepts_stripe?: boolean
      accepts_offline_etransfer?: boolean
      accepts_offline_cash?: boolean
    }
  }

  const profileUpdates: Record<string, unknown> = {}
  if (body.etransferPaymentEmail !== undefined) {
    profileUpdates.etransfer_payment_email = body.etransferPaymentEmail?.trim() || null
  }
  if (body.offlinePaymentInstructions !== undefined) {
    profileUpdates.offline_payment_instructions = body.offlinePaymentInstructions?.trim() || null
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (body.defaultEventPaymentFlags) {
    const flags = body.defaultEventPaymentFlags
    const eventUpdates: Record<string, boolean> = {}
    if (typeof flags.accepts_square === 'boolean') eventUpdates.accepts_square = flags.accepts_square
    if (typeof flags.accepts_stripe === 'boolean') eventUpdates.accepts_stripe = flags.accepts_stripe
    if (typeof flags.accepts_offline_etransfer === 'boolean') {
      eventUpdates.accepts_offline_etransfer = flags.accepts_offline_etransfer
    }
    if (typeof flags.accepts_offline_cash === 'boolean') {
      eventUpdates.accepts_offline_cash = flags.accepts_offline_cash
    }

    if (Object.keys(eventUpdates).length > 0) {
      const { error } = await supabase
        .from('events')
        .update(eventUpdates)
        .eq('coordinator_id', user.id)
        .in('status', ['draft', 'published', 'active'])

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
