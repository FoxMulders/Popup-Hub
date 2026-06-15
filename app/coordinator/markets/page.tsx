import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { partitionEventsByPhase, sortEventsByStartAsc, sortEventsByStartDesc } from '@/lib/queries/events'
import {
  CoordinatorMarketsList,
  type CoordinatorMarketSummary,
} from '@/components/coordinator/coordinator-markets-list'
import type { Event } from '@/types/database'

function toMarketSummary(event: Pick<Event, 'id' | 'name' | 'start_at' | 'status'>): CoordinatorMarketSummary {
  return {
    id: event.id,
    name: event.name,
    start_at: event.start_at,
    status: event.status,
  }
}

export default async function CoordinatorMarketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const eventsQuery = supabase
    .from('events')
    .select('id, name, start_at, status')
    .order('start_at', { ascending: false })

  const [{ data: profile }, { data: eventRows }, { data: revenueRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'payout_onboarding_status, payout_account_id, stripe_connected_id, stripe_onboarding_complete'
      )
      .eq('id', user.id)
      .single(),
    scope.isAdmin ? eventsQuery : eventsQuery.eq('coordinator_id', user.id),
    (scope.isAdmin
      ? supabase.from('platform_transactions').select('organizer_payout_amount').eq('status', 'completed')
      : supabase
          .from('platform_transactions')
          .select('organizer_payout_amount')
          .eq('status', 'completed')
          .eq('coordinator_id', user.id)),
  ])

  const { active, archived } = partitionEventsByPhase((eventRows ?? []) as Event[])
  const activeMarkets = sortEventsByStartAsc(active).map(toMarketSummary)
  const archivedMarkets = sortEventsByStartDesc(archived).map(toMarketSummary)

  const totalRevenueCents =
    revenueRows?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0

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
    />
  )
}
