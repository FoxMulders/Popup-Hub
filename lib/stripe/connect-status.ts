import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/server'
import type { PayoutOnboardingStatus } from '@/types/database'

export function isStripePayoutActive(profile: {
  stripe_connected_id?: string | null
  payout_onboarding_status?: PayoutOnboardingStatus | null
} | null): boolean {
  return (
    !!profile?.stripe_connected_id &&
    profile.payout_onboarding_status === 'complete'
  )
}

export async function syncStripeConnectStatus(
  supabase: SupabaseClient,
  userId: string,
  stripeAccountId: string
): Promise<boolean> {
  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(stripeAccountId)

  const isActive = account.charges_enabled === true && account.details_submitted === true
  const nextStatus: PayoutOnboardingStatus = isActive
    ? 'complete'
    : account.requirements?.disabled_reason
      ? 'restricted'
      : 'pending'

  await supabase
    .from('profiles')
    .update({
      payout_onboarding_status: nextStatus,
      payout_account_id: stripeAccountId,
    })
    .eq('id', userId)

  return isActive
}
