import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { isStripePayoutActive, syncStripeConnectStatus } from '@/lib/stripe/connect-status'

interface CoordinatorStripePayoutProps {
  userId: string
  variant?: 'header' | 'card'
}

export async function CoordinatorStripePayout({
  userId,
  variant = 'header',
}: CoordinatorStripePayoutProps) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connected_id, payout_onboarding_status')
    .eq('id', userId)
    .single()

  if (profile?.stripe_connected_id && profile.payout_onboarding_status !== 'complete') {
    try {
      await syncStripeConnectStatus(supabase, userId, profile.stripe_connected_id)
    } catch {
      // Stripe sync is best-effort for display state.
    }
  }

  const { data: refreshedProfile } = await supabase
    .from('profiles')
    .select('stripe_connected_id, payout_onboarding_status')
    .eq('id', userId)
    .single()

  const stripeActive = isStripePayoutActive(refreshedProfile)

  if (stripeActive) {
    if (variant === 'card') {
      return <span className="text-sm font-medium text-sage-700">Connected</span>
    }

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        ✅ Payout Account Active (Stripe Connected)
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Link href="/api/stripe/connect" className={buttonVariants({ variant: 'link', size: 'sm' }) + ' h-auto p-0 text-sm text-sage-700'}>
        💳 Connect Payouts (Stripe) →
      </Link>
    )
  }

  return (
    <Link href="/api/stripe/connect">
      <Button variant="outline" size="sm">
        💳 Connect Payouts (Stripe)
      </Button>
    </Link>
  )
}

export async function CoordinatorStripeReturnNotice({
  userId,
  status,
}: {
  userId: string
  status?: string
}) {
  if (!status || status === 'refresh') return null

  const supabase = await createClient()

  if (status === 'success') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connected_id')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.stripe_connected_id) {
      try {
        await syncStripeConnectStatus(supabase, userId, profile.stripe_connected_id)
      } catch {
        // Fall through to generic messaging below.
      }
    }

    const { data: refreshed } = await supabase
      .from('profiles')
      .select('stripe_connected_id, payout_onboarding_status')
      .eq('id', userId)
      .maybeSingle()

    if (isStripePayoutActive(refreshed)) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Stripe payout onboarding completed successfully.
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Stripe onboarding saved. Finish any remaining steps using{' '}
        <Link href="/api/stripe/connect" className="font-semibold underline">
          Connect Payouts (Stripe)
        </Link>
        .
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not start Stripe onboarding. Verify your Stripe keys and try again.
      </div>
    )
  }

  return null
}
