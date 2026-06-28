import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { partitionEventsByPhase, sortEventsByStartAsc, sortEventsByStartDesc } from '@/lib/queries/events'
import {
  CoordinatorMarketsList,
  type CoordinatorMarketSummary,
} from '@/components/coordinator/coordinator-markets-list'
import { formatCoordinatorOwnerLabel } from '@/lib/coordinator/coordinator-owner-label'
import type { Event } from '@/types/database'

type MarketEventRow = Pick<Event, 'id' | 'name' | 'start_at' | 'status' | 'is_test'> & {
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

function toMarketSummary(
  event: MarketEventRow,
  includeCoordinator: boolean
): CoordinatorMarketSummary {
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  return {
    id: event.id,
    name: event.name,
    start_at: event.start_at,
    status: event.status,
    is_test: event.is_test ?? false,
    coordinator_name: includeCoordinator ? formatCoordinatorOwnerLabel(coordinator) : undefined,
  }
}

export default async function CoordinatorMarketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const eventsPromise = scope.isAdmin
    ? supabase
        .from('events')
        .select(
          'id, name, start_at, status, is_test, coordinator:profiles!events_coordinator_id_fkey(full_name, coordinator_organization_name, email)'
        )
        .order('start_at', { ascending: false })
    : supabase
        .from('events')
        .select('id, name, start_at, status, is_test')
        .eq('coordinator_id', user.id)
        .order('start_at', { ascending: false })

  const [{ data: profile }, eventsResult, revenueResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'payout_onboarding_status, payout_account_id, stripe_connected_id, stripe_onboarding_complete'
      )
      .eq('id', user.id)
      .maybeSingle(),
    eventsPromise,
    scope.isAdmin
      ? supabase.from('platform_transactions').select('organizer_payout_amount').eq('status', 'completed')
      : supabase
          .from('platform_transactions')
          .select('organizer_payout_amount')
          .eq('status', 'completed')
          .eq('coordinator_id', user.id),
  ])

  const eventRows = (eventsResult.data ?? []) as unknown as MarketEventRow[]
  if (eventsResult.error) {
    console.error('[coordinator/markets] events query failed', eventsResult.error.message)
  }
  if (revenueResult.error) {
    console.error('[coordinator/markets] revenue query failed', revenueResult.error.message)
  }

  const { active, archived } = partitionEventsByPhase(eventRows as Event[])
  const activeMarkets = sortEventsByStartAsc(active).map((event) =>
    toMarketSummary(event as MarketEventRow, scope.isAdmin)
  )
  const archivedMarkets = sortEventsByStartDesc(archived).map((event) =>
    toMarketSummary(event as MarketEventRow, scope.isAdmin)
  )

  const totalRevenueCents =
    revenueResult.data?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0

  const squareConnected =
    profile?.payout_onboarding_status === 'complete' && !!profile.payout_account_id
  const stripeConnected =
    !!profile?.stripe_connected_id && profile?.stripe_onboarding_complete === true

  return (
    <CoordinatorMarketsList
      activeMarkets={activeMarkets}
      archivedMarkets={archivedMarkets}
      totalRevenueCents={totalRevenueCents}
      squareConnected={squareConnected}
      stripeConnected={stripeConnected}
      isAdminView={scope.isAdmin}
    />
  )
}
