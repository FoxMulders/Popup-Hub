import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

export async function ensureStripeConnectAccount(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ accountId: string; created: boolean } | null> {
  if (!isStripeConfigured()) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, stripe_connected_id')
    .eq('id', coordinatorId)
    .single()

  if (!profile) return null

  const stripe = getStripeClient()

  if (profile.stripe_connected_id) {
    return { accountId: profile.stripe_connected_id, created: false }
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'CA',
    email: profile.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: profile.full_name || undefined,
    },
    metadata: {
      coordinator_id: coordinatorId,
    },
  })

  await supabase
    .from('profiles')
    .update({ stripe_connected_id: account.id })
    .eq('id', coordinatorId)

  return { accountId: account.id, created: true }
}

export async function createStripeConnectAccountLink(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ url: string } | null> {
  const ensured = await ensureStripeConnectAccount(supabase, coordinatorId)
  if (!ensured) return null

  const stripe = getStripeClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  const link = await stripe.accountLinks.create({
    account: ensured.accountId,
    refresh_url: `${baseUrl}/coordinator/payment-methods?stripe=refresh`,
    return_url: `${baseUrl}/coordinator/payment-methods?stripe=connected`,
    type: 'account_onboarding',
  })

  return { url: link.url }
}

export async function refreshStripeConnectStatus(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connected_id')
    .eq('id', coordinatorId)
    .single()

  if (!profile?.stripe_connected_id || !isStripeConfigured()) {
    return false
  }

  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(profile.stripe_connected_id)
  const complete =
    account.charges_enabled === true &&
    account.payouts_enabled === true &&
    account.details_submitted === true

  await supabase
    .from('profiles')
    .update({ stripe_onboarding_complete: complete })
    .eq('id', coordinatorId)

  return complete
}
