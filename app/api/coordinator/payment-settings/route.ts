import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPaymentCollectionBlockReason,
  isSquareConnectedCoordinator,
} from '@/lib/coordinator/verification'
import { createClient } from '@/lib/supabase/server'
import {
  readCoordinatorPaymentInstructions,
  readUnifiedEventPaymentFlags,
  writeCoordinatorPaymentInstructions,
  writeEventPaymentFlags,
} from '@/lib/payments/event-payment-flags'
import { getCoordinatorBalanceOwed } from '@/lib/payments/account-balance'
import { isStripeConfigured } from '@/lib/stripe/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile }, { data: wallet }, balance] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'role, is_admin, etransfer_payment_email, offline_payment_instructions, payment_instructions, stripe_connected_id, stripe_onboarding_complete, platform_wallet_blocked, platform_wallet_grace_until, payout_account_id, square_access_token, payout_onboarding_status'
      )
      .eq('id', user.id)
      .single(),
    supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    getCoordinatorBalanceOwed(supabase, user.id),
  ])

  if (!profile || !canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const { data: connectedEvent } = await supabase
    .from('events')
    .select(
      'accepts_credit_card, accepts_etransfer, accepts_cash, accepts_square, accepts_stripe, accepts_offline_etransfer, accepts_offline_cash'
    )
    .eq('coordinator_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const squareConnected = isSquareConnectedCoordinator(profile)

  const unifiedFlags = readUnifiedEventPaymentFlags(connectedEvent ?? {})

  return NextResponse.json({
    walletBalanceCents: wallet?.balance ?? 0,
    walletBlocked: profile.platform_wallet_blocked === true,
    walletGraceUntil: profile.platform_wallet_grace_until,
    balanceOwed: balance,
    etransferPaymentEmail: profile.etransfer_payment_email,
    paymentInstructions: readCoordinatorPaymentInstructions(profile),
    offlinePaymentInstructions: readCoordinatorPaymentInstructions(profile),
    squareConnected,
    stripeConnected: !!profile.stripe_connected_id,
    stripeOnboardingComplete: profile.stripe_onboarding_complete === true,
    stripeConfigured: isStripeConfigured(),
    defaultEventPaymentFlags: unifiedFlags,
    defaultEventPaymentFlagsLegacy: {
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
    .select(`role, is_admin, ${COORDINATOR_FRAUD_PROFILE_SELECT}`)
    .eq('id', user.id)
    .single()

  if (!profile || !canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    etransferPaymentEmail?: string | null
    offlinePaymentInstructions?: string | null
    paymentInstructions?: string | null
    defaultEventPaymentFlags?: {
      accepts_credit_card?: boolean
      accepts_etransfer?: boolean
      accepts_cash?: boolean
      accepts_square?: boolean
      accepts_stripe?: boolean
      accepts_offline_etransfer?: boolean
      accepts_offline_cash?: boolean
    }
  }

  const enablingAcceptanceFlags =
    body.defaultEventPaymentFlags !== undefined &&
    (body.defaultEventPaymentFlags.accepts_credit_card === true ||
      body.defaultEventPaymentFlags.accepts_etransfer === true ||
      body.defaultEventPaymentFlags.accepts_cash === true ||
      body.defaultEventPaymentFlags.accepts_square === true ||
      body.defaultEventPaymentFlags.accepts_stripe === true ||
      body.defaultEventPaymentFlags.accepts_offline_etransfer === true ||
      body.defaultEventPaymentFlags.accepts_offline_cash === true)

  if (enablingAcceptanceFlags) {
    const paymentBlock = coordinatorPaymentCollectionBlockReason(profile)
    if (paymentBlock) {
      return NextResponse.json({ error: paymentBlock }, { status: 403 })
    }
  }

  const profileUpdates: Record<string, unknown> = {}
  if (body.etransferPaymentEmail !== undefined) {
    profileUpdates.etransfer_payment_email = body.etransferPaymentEmail?.trim() || null
  }

  const instructions =
    body.paymentInstructions !== undefined
      ? body.paymentInstructions
      : body.offlinePaymentInstructions
  if (instructions !== undefined) {
    Object.assign(profileUpdates, writeCoordinatorPaymentInstructions(instructions))
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (body.defaultEventPaymentFlags) {
    const flags = body.defaultEventPaymentFlags
    const unified = {
      accepts_credit_card:
        typeof flags.accepts_credit_card === 'boolean'
          ? flags.accepts_credit_card
          : typeof flags.accepts_square === 'boolean' || typeof flags.accepts_stripe === 'boolean'
            ? (flags.accepts_square ?? true) || (flags.accepts_stripe ?? false)
            : undefined,
      accepts_etransfer:
        typeof flags.accepts_etransfer === 'boolean'
          ? flags.accepts_etransfer
          : flags.accepts_offline_etransfer,
      accepts_cash:
        typeof flags.accepts_cash === 'boolean' ? flags.accepts_cash : flags.accepts_offline_cash,
    }
    const eventUpdates = writeEventPaymentFlags(unified)

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
