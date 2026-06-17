import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { redirect } from 'next/navigation'
import { partitionEventsByPhase, sortEventsByStartAsc, sortEventsByStartDesc } from '@/lib/queries/events'
import type { Event } from '@/types/database'
import { roomsFromBoothLayoutForEditor } from '@/lib/booth-planner/layout-rooms'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import {
  coordinatorHasPaymentTrustPath,
  coordinatorPaymentCollectionBlockReason,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'
import { MarketDashboardClient } from '@/components/coordinator/dashboard/market-dashboard-client'
import type { VendorApplicationSnapshot } from '@/components/coordinator/dashboard/booth-placement-status'
import type { DashboardEventSummary } from '@/components/coordinator/dashboard/market-management-context'

function vendorNameFromRow(app: {
  vendor?: { full_name?: string | null } | { full_name?: string | null }[] | null
}): string | null {
  const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
  return vendor?.full_name ?? null
}

function categoryNameFromRow(app: {
  category?: { name?: string | null } | { name?: string | null }[] | null
}): string | null {
  const category = Array.isArray(app.category) ? app.category[0] : app.category
  return category?.name ?? null
}

interface StudioPageProps {
  searchParams: Promise<{ event?: string }>
}

export default async function CoordinatorStudioPage({ searchParams }: StudioPageProps) {
  const { event: eventQuery } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const eventsQuery = supabase
    .from('events')
    .select('id, name, start_at, end_at, status, listing_type, booth_price_cents, multi_table_discount_percent')
    .order('start_at', { ascending: false })

  const { data: eventRows } = scope.isAdmin
    ? await eventsQuery
    : await eventsQuery.eq('coordinator_id', user.id)

  const coordinatorEventIds = (eventRows ?? []).map((e) => e.id)

  const revenueBaseQuery = supabase
    .from('platform_transactions')
    .select('organizer_payout_amount')
    .eq('status', 'completed')
  const revenueQuery = scope.isAdmin
    ? revenueBaseQuery
    : revenueBaseQuery.eq('coordinator_id', user.id)

  const [
    { data: profile },
    { data: revenueRows },
    { data: layouts },
    { data: applications },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'payout_onboarding_status, payout_account_id, stripe_connected_id, stripe_onboarding_complete, square_access_token, coordinator_verification_status, coordinator_organization_name, coordinator_business_number, coordinator_risk_score, coordinator_account_status, coordinator_is_verified, coordinator_successful_events_count'
      )
      .eq('id', user.id)
      .single(),
    revenueQuery,
    coordinatorEventIds.length > 0
      ? supabase.from('booth_layouts').select('*').in('event_id', coordinatorEventIds)
      : Promise.resolve({ data: [] as import('@/types/database').BoothLayout[] }),
    coordinatorEventIds.length > 0
      ? supabase
          .from('booth_applications')
          .select(`
            *,
            vendor:profiles!booth_applications_vendor_id_fkey(full_name, email),
            event:events(id, name, listing_type, booth_price_cents, multi_table_discount_percent),
            category:categories(name)
          `)
          .in('event_id', coordinatorEventIds)
          .order('applied_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const { active, archived } = partitionEventsByPhase((eventRows ?? []) as Event[])
  const activeSorted = sortEventsByStartAsc(active)
  const archivedSorted = sortEventsByStartDesc(archived)
  const allStudioEvents = [...activeSorted, ...archivedSorted]

  const events: DashboardEventSummary[] = allStudioEvents.map((e) => ({
    id: e.id,
    name: e.name,
    start_at: e.start_at,
    status: e.status,
  }))

  const eventIds = new Set(events.map((e) => e.id))
  const coordinatorEventIdSet = new Set(coordinatorEventIds)

  const layoutsByEventId: Record<
    string,
    { rooms: ReturnType<typeof roomsFromBoothLayoutForEditor>['rooms']; activeRoomId: string }
  > = {}
  for (const layout of layouts ?? []) {
    if (!coordinatorEventIdSet.has(layout.event_id)) continue
    const bundle = roomsFromBoothLayoutForEditor(layout)
    layoutsByEventId[layout.event_id] = {
      rooms: bundle.rooms,
      activeRoomId: bundle.activeRoomId,
    }
  }

  for (const event of events) {
    if (!layoutsByEventId[event.id]) {
      const empty = roomsFromBoothLayoutForEditor(null)
      layoutsByEventId[event.id] = {
        rooms: empty.rooms,
        activeRoomId: empty.activeRoomId,
      }
    }
  }

  const categoryPriceKeys = new Set<string>()
  for (const app of applications ?? []) {
    if (!eventIds.has(app.event_id)) continue
    categoryPriceKeys.add(`${app.event_id}:${app.category_id}`)
  }

  const uniqueEventIdsForLimits = [...new Set([...categoryPriceKeys].map((k) => k.split(':')[0]!))]
  const coordinatorEventIdsForLimits =
    coordinatorEventIds.length > 0 ? coordinatorEventIds : []
  const { data: limits } =
    uniqueEventIdsForLimits.length > 0
      ? await supabase
          .from('event_category_limits')
          .select('event_id, category_id, price_per_booth, category:categories(name)')
          .in('event_id', uniqueEventIdsForLimits)
      : { data: [] as Array<{
          event_id: string
          category_id: string
          price_per_booth: number | null
          category?: { name?: string | null } | { name?: string | null }[] | null
        }> }

  const { data: allCategoryLimits } =
    coordinatorEventIdsForLimits.length > 0
      ? await supabase
          .from('event_category_limits')
          .select('event_id, category:categories(name)')
          .in('event_id', coordinatorEventIdsForLimits)
      : { data: [] as Array<{
          event_id: string
          category?: { name?: string | null } | { name?: string | null }[] | null
        }> }

  const eventCategoryNamesByEventId: Record<string, string[]> = {}
  for (const row of allCategoryLimits ?? []) {
    if (!eventIds.has(row.event_id)) continue
    const category = Array.isArray(row.category) ? row.category[0] : row.category
    const name = category?.name?.trim()
    if (!name) continue
    const list = eventCategoryNamesByEventId[row.event_id] ?? []
    if (!list.includes(name)) list.push(name)
    eventCategoryNamesByEventId[row.event_id] = list
  }
  for (const eventId of Object.keys(eventCategoryNamesByEventId)) {
    eventCategoryNamesByEventId[eventId]!.sort()
  }

  const priceByKey = new Map(
    (limits ?? []).map((row) => [`${row.event_id}:${row.category_id}`, row.price_per_booth ?? 0])
  )

  const toSnapshot = (app: NonNullable<typeof applications>[number]): VendorApplicationSnapshot => ({
    id: app.id,
    vendor_id: app.vendor_id,
    status: app.status,
    payment_status: app.payment_status,
    payment_method: app.payment_method,
    application_payment_status: app.application_payment_status,
    booth_number: app.booth_number,
    categoryName: categoryNameFromRow(app),
    vendorName: vendorNameFromRow(app),
    tableCount: Math.max(1, (app as { table_count?: number }).table_count ?? 1),
  })

  const approvedByEventId: Record<string, VendorApplicationSnapshot[]> = {}
  const pendingByEventId: Record<string, VendorApplicationSnapshot[]> = {}
  const boothPriceByEventAndApplicationId: Record<string, Record<string, number>> = {}

  for (const app of applications ?? []) {
    if (!eventIds.has(app.event_id)) continue
    const snapshot = toSnapshot(app)
    const eventRow = Array.isArray(app.event) ? app.event[0] : app.event
    const categoryPrice = priceByKey.get(`${app.event_id}:${app.category_id}`) ?? 0
    const boothPrice = computeApplicationBoothPriceCents(
      categoryPrice,
      {
        listing_type: eventRow?.listing_type,
        booth_price_cents: eventRow?.booth_price_cents,
        multi_table_discount_percent: eventRow?.multi_table_discount_percent,
      },
      (app as { table_count?: number }).table_count ?? 1
    )
    if (!boothPriceByEventAndApplicationId[app.event_id]) {
      boothPriceByEventAndApplicationId[app.event_id] = {}
    }
    boothPriceByEventAndApplicationId[app.event_id]![app.id] = boothPrice

    if (app.status === 'approved' || app.status === 'pending_insurance' || app.status === 'waitlisted') {
      if (!approvedByEventId[app.event_id]) approvedByEventId[app.event_id] = []
      approvedByEventId[app.event_id]!.push(snapshot)
    }
    if (app.status === 'pending' || app.status === 'pending_insurance') {
      if (!pendingByEventId[app.event_id]) pendingByEventId[app.event_id] = []
      pendingByEventId[app.event_id]!.push(snapshot)
    }
  }

  const totalRevenueCents =
    revenueRows?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0

  const { data: squareEvent } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', user.id)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const fraudGate = {
    ...profile,
    has_square_event: !!squareEvent,
  }

  const squareConnected =
    profile?.payout_onboarding_status === 'complete' && !!profile.payout_account_id
  const stripeConnected =
    !!profile?.stripe_connected_id && profile?.stripe_onboarding_complete === true
  const paymentTrustComplete = coordinatorHasPaymentTrustPath(fraudGate)

  const initialEventId =
    eventQuery && allStudioEvents.some((e) => e.id === eventQuery)
      ? eventQuery
      : activeSorted[0]?.id ?? archivedSorted[0]?.id ?? null

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Blueprint Studio…</div>}>
      <MarketDashboardClient
        events={events}
        initialEventId={initialEventId}
        layoutsByEventId={layoutsByEventId}
        approvedByEventId={approvedByEventId}
        pendingByEventId={pendingByEventId}
        boothPriceByEventAndApplicationId={boothPriceByEventAndApplicationId}
        eventCategoryNamesByEventId={eventCategoryNamesByEventId}
        squareConnected={squareConnected}
        stripeConnected={stripeConnected}
        totalRevenueCents={totalRevenueCents}
        verificationStatus={profile?.coordinator_verification_status ?? 'unverified'}
        organizationName={profile?.coordinator_organization_name ?? null}
        publishBlockReason={coordinatorPublishBlockReason(fraudGate)}
        paymentCollectionBlockReason={coordinatorPaymentCollectionBlockReason(fraudGate)}
        paymentTrustComplete={paymentTrustComplete}
      />
    </Suspense>
  )
}
