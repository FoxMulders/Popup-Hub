import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { fetchCoordinatorClaimSuggestions } from '@/lib/organizers/fetch-coordinator-claim-suggestions'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorHasPaymentTrustPath,
  coordinatorPublishBlockReason,
  isSquareConnectedCoordinator,
} from '@/lib/coordinator/verification'
import { CoordinatorHome } from '@/components/coordinator/coordinator-home'

export default async function CoordinatorHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const [{ data: profile }, eventsQuery, claimSuggestions, { data: coordProfile }, { data: squareEvent }] =
    await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    scope.isAdmin
      ? supabase.from('events').select('id', { count: 'exact', head: true })
      : supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('coordinator_id', user.id),
    fetchCoordinatorClaimSuggestions(user.id),
    supabase
      .from('profiles')
      .select(COORDINATOR_FRAUD_PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id')
      .eq('coordinator_id', user.id)
      .not('square_merchant_id', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])

  const marketCount = eventsQuery.count ?? 0
  const paymentGate = {
    ...coordProfile,
    has_square_event: Boolean(squareEvent),
  }
  const showPaymentReadiness =
    coordinatorPublishBlockReason(paymentGate)?.includes('Connect Stripe or Square') === true &&
    !coordinatorHasPaymentTrustPath(paymentGate)

  return (
    <CoordinatorHome
      displayName={profile?.full_name ?? null}
      marketCount={marketCount}
      claimSuggestions={claimSuggestions}
      showPaymentReadiness={showPaymentReadiness}
      organizationName={coordProfile?.coordinator_organization_name ?? null}
      squareConnected={isSquareConnectedCoordinator(paymentGate)}
      stripeConnected={coordProfile?.stripe_onboarding_complete === true}
    />
  )
}
