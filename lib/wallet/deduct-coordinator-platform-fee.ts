import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_GRACE_DAYS = 7

export type DeductPlatformFeeResult =
  | {
      ok: true
      platformFeeCents: number
      newBalance: number
      walletBlocked: boolean
    }
  | { ok: false; error: 'not_found' | 'blocked' }

/**
 * Debit Popup Hub platform fee from the coordinator wallet after offline payment clearance.
 * Allows negative balance during grace; sets platform_wallet_blocked when grace expires.
 */
export async function deductCoordinatorPlatformFee(
  supabase: SupabaseClient,
  params: {
    coordinatorId: string
    platformFeeCents: number
    applicationId: string
    paymentMethod: string
  }
): Promise<DeductPlatformFeeResult> {
  const fee = Math.max(0, Math.round(params.platformFeeCents))
  if (fee === 0) {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', params.coordinatorId)
      .maybeSingle()
    return {
      ok: true,
      platformFeeCents: 0,
      newBalance: wallet?.balance ?? 0,
      walletBlocked: false,
    }
  }

  const [{ data: profile }, { data: wallet }] = await Promise.all([
    supabase
      .from('profiles')
      .select('platform_wallet_blocked, platform_wallet_grace_until')
      .eq('id', params.coordinatorId)
      .single(),
    supabase.from('wallets').select('id, balance').eq('user_id', params.coordinatorId).single(),
  ])

  if (!wallet) {
    return { ok: false, error: 'not_found' }
  }

  if (profile?.platform_wallet_blocked) {
    const graceUntil = profile.platform_wallet_grace_until
      ? new Date(profile.platform_wallet_grace_until).getTime()
      : 0
    if (!graceUntil || Date.now() > graceUntil) {
      return { ok: false, error: 'blocked' }
    }
  }

  const newBalance = wallet.balance - fee
  const graceUntil =
    newBalance < 0
      ? new Date(Date.now() + DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null
  const walletBlocked = newBalance < 0

  const { error: walletError } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance)

  if (walletError) {
    return { ok: false, error: 'not_found' }
  }

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'withdrawal',
    amount: fee,
    metadata: {
      kind: 'platform_fee_offline',
      application_id: params.applicationId,
      payment_method: params.paymentMethod,
    },
  })

  await supabase
    .from('profiles')
    .update({
      platform_wallet_blocked: walletBlocked,
      platform_wallet_grace_until: graceUntil,
    })
    .eq('id', params.coordinatorId)

  return {
    ok: true,
    platformFeeCents: fee,
    newBalance,
    walletBlocked,
  }
}
