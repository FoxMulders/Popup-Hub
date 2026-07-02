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
import { formatCoordinatorOwnerLabel } from '@/lib/coordinator/coordinator-owner-label'
import type { Event } from '@/types/database'

type HomeEventRow = Pick<
  Event,
  'id' | 'name' | 'start_at' | 'status' | 'is_external_listing' | 'ad_campaign_status'
> & {
  coordinator?:
    | {
        full_name?: string | null
        coordinator_organization_name?: string | null
        email?: string | null
      }
    | {
        full_name?: string | null
        coordinator_organization_name?: string | null
        email?: string | null
      }[]
    | null
}

function toHomeMarket(event: HomeEventRow, includeCoordinator: boolean) {
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  return {
    id: event.id,
    name: event.name,
    start_at: event.start_at,
    status: event.status,
    is_external_listing: event.is_external_listing ?? false,
    ad_campaign_status: event.ad_campaign_status ?? null,
    coordinator_name: includeCoordinator ? formatCoordinatorOwnerLabel(coordinator) : undefined,
  }
}

export default async function CoordinatorHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const [{ data: profile }, eventsQuery, claimSuggestions, { data: coordProfile }, { data: squareEvent }, { data: recentEvents }] =
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
    scope.isAdmin
      ? supabase
          .from('events')
          .select(
            'id, name, start_at, status, is_external_listing, ad_campaign_status, coordinator:profiles!events_coordinator_id_fkey(full_name, coordinator_organization_name, email)'
          )
          .order('start_at', { ascending: true })
          .limit(6)
      : supabase
          .from('events')
          .select('id, name, start_at, status, is_external_listing, ad_campaign_status')
          .eq('coordinator_id', user.id)
          .order('start_at', { ascending: true })
          .limit(6),
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
      recentMarkets={(recentEvents ?? []).map((event) =>
        toHomeMarket(event as HomeEventRow, scope.isAdmin)
      )}
      claimSuggestions={claimSuggestions}
      showPaymentReadiness={showPaymentReadiness}
      organizationName={coordProfile?.coordinator_organization_name ?? null}
      squareConnected={isSquareConnectedCoordinator(paymentGate)}
      stripeConnected={coordProfile?.stripe_onboarding_complete === true}
      isAdminView={scope.isAdmin}
    />
  )
}
