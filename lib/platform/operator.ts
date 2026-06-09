import type { SupabaseClient } from '@supabase/supabase-js'

/** Platform admin — sole `is_admin` (not a market host). */
export const PLATFORM_OPERATOR_EMAIL = 'bradmulders@gmail.com'

/** Popup Hub Square application owner (appFeeMoney destination). */
export const PLATFORM_SQUARE_OPERATOR_EMAIL = 'thetipsyfoxyeg@gmail.com'

/**
 * Platform fees (3% + $1) for this operator are retained on Square only:
 * - Square: `appFeeMoney` on the Popup Hub Square application — owner: PLATFORM_SQUARE_OPERATOR_EMAIL (The Tipsy Fox)
 *
 * PLATFORM_OPERATOR_EMAIL is platform admin identity (`is_admin`, /admin/feedback) — not a payment settlement account.
 *
 * Coordinator booth splits still route to each event coordinator's connected Square/Stripe accounts.
 *
 * Inactive Stripe fee rails (code retained, not used by this operator):
 * - Stripe Connect `application_fee_amount` on card checkout (`app/api/stripe/booth-payment`)
 * - Offline `account_balances` invoicing via Stripe Checkout (`lib/cron/coordinator-platform-invoice`)
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
