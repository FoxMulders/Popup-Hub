import type { SupabaseClient } from '@supabase/supabase-js'

/** Canonical platform operator — sole admin (not a market host). */
export const PLATFORM_OPERATOR_EMAIL = 'bradmulders@gmail.com'

/**
 * Platform fees (3% + $1) are retained by Popup Hub payment processors:
 * - Stripe Connect: `application_fee_amount` on the platform Stripe account (STRIPE_SECRET_KEY)
 * - Square: `appFeeMoney` on the Popup Hub Square application
 * - Offline booth payments: coordinators accrue fees in account_balances and pay via Stripe Checkout to the same platform Stripe account
 *
 * This profile id is for admin/ops identity — not a booth payout destination.
 */
export async function resolvePlatformOperatorId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('platform_operator_id')
    .eq('id', 1)
    .maybeSingle()

  if (settings?.platform_operator_id) {
    return settings.platform_operator_id
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', PLATFORM_OPERATOR_EMAIL)
    .maybeSingle()

  return profile?.id ?? null
}

/** @deprecated Use resolvePlatformOperatorId — platform fees do not route through coordinator Connect. */
export const resolvePlatformPayoutCoordinatorId = resolvePlatformOperatorId
