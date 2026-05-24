import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CoordinatorEventFeed } from '@/components/coordinator/coordinator-event-feed'
import {
  partitionEventsByPhase,
  sortEventsByStartAsc,
  sortEventsByStartDesc,
} from '@/lib/queries/events'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Calendar, Clock, DollarSign } from 'lucide-react'
import type { Event } from '@/types/database'
import { PendingBoothApplicationsPanel } from '@/components/coordinator/pending-booth-applications-panel'
import type { PendingBoothApplicationRow } from '@/components/coordinator/pending-booth-applications-panel'
import { PendingEtransferPanel } from '@/components/coordinator/pending-etransfer-panel'
import type { PendingEtransferApplication } from '@/components/coordinator/pending-etransfer-panel'

async function CoordinatorStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: myEventIds } = await supabase.from('events').select('id').eq('coordinator_id', userId)
  const eventIds = myEventIds?.map((e) => e.id) ?? []

  const [
    { count: totalEvents },
    { count: pendingApplications },
    { count: pendingInsuranceApplications },
    { data: firstPendingApplication },
    { data: revenueRows },
    { data: profile },
  ] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('coordinator_id', userId),
    eventIds.length > 0
      ? supabase
          .from('booth_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('event_id', eventIds)
      : Promise.resolve({ count: 0 }),
    eventIds.length > 0
      ? supabase
          .from('booth_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_insurance')
          .in('event_id', eventIds)
      : Promise.resolve({ count: 0 }),
    eventIds.length > 0
      ? supabase
          .from('booth_applications')
          .select('event_id, event:events(name)')
          .in('status', ['pending', 'pending_insurance'])
          .in('event_id', eventIds)
          .order('applied_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('platform_transactions')
      .select('organizer_payout_amount')
      .eq('coordinator_id', userId)
      .eq('status', 'completed'),
    supabase
      .from('profiles')
      .select('payout_onboarding_status, payout_account_id')
      .eq('id', userId)
      .single(),
  ])

  const totalRevenueCents =
    revenueRows?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0
  const revenueFormatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(totalRevenueCents / 100)

  const squareConnected =
    profile?.payout_onboarding_status === 'complete' && !!profile.payout_account_id

  const pendingCount = (pendingApplications ?? 0) + (pendingInsuranceApplications ?? 0)
  const pendingEventId = firstPendingApplication?.event_id as string | undefined
  const pendingEvent = Array.isArray(firstPendingApplication?.event)
    ? firstPendingApplication?.event[0]
    : firstPendingApplication?.event
  const pendingEventName = pendingEvent?.name as string | undefined
  const pendingHref = pendingEventId
    ? `/coordinator/events/${pendingEventId}/applications`
    : null

  const pendingCard = (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Booth Applications
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-harvest-500" />
          <span className="text-2xl font-bold">{pendingCount}</span>
        </div>
        {pendingCount > 0 && pendingHref ? (
          <p className="text-xs font-medium text-harvest-700">
            Review{pendingEventName ? ` · ${pendingEventName}` : ''} →
          </p>
        ) : null}
      </CardContent>
    </>
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-forest" />
          <span className="text-2xl font-bold">{totalEvents ?? 0}</span>
        </CardContent>
      </Card>
      {pendingCount > 0 && pendingHref ? (
        <Link href={pendingHref} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harvest-400">
          <Card className="h-full transition-colors group-hover:border-harvest-300 group-hover:bg-harvest-50/40">
            {pendingCard}
          </Card>
        </Link>
      ) : (
        <Card>{pendingCard}</Card>
      )}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Booth Revenue</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-sage-600" />
          <span className="text-2xl font-bold">{revenueFormatted}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Square Payouts</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          {squareConnected ? (
            <span className="text-sm font-medium text-sage-700">Connected</span>
          ) : (
            <Link href="/coordinator/square-connect">
              <Button variant="link" size="sm" className="h-auto p-0 text-sm text-sage-700">
                Connect Square →
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function MyEvents({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('coordinator_id', userId)
    .order('start_at', { ascending: false })

  const { active, archived } = partitionEventsByPhase((events ?? []) as Event[])

  return (
    <CoordinatorEventFeed
      activeEvents={sortEventsByStartAsc(active)}
      archivedEvents={sortEventsByStartDesc(archived)}
    />
  )
}

export default async function CoordinatorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myEvents } = await supabase
    .from('events')
    .select('id, name')
    .eq('coordinator_id', user.id)
    .order('start_at', { ascending: false })

  const eventIds = myEvents?.map((e) => e.id) ?? []
  const firstEventApplicationsHref =
    myEvents?.[0]?.id != null ? `/coordinator/events/${myEvents[0].id}/applications` : null

  let pendingBoothApplications: PendingBoothApplicationRow[] = []
  if (eventIds.length > 0) {
    const { data: boothApps } = await supabase
      .from('booth_applications')
      .select(`
        *,
        vendor:profiles!booth_applications_vendor_id_fkey(full_name, email),
        event:events(id, name, booking_mode),
        category:categories(name)
      `)
      .in('event_id', eventIds)
      .in('status', ['pending', 'pending_insurance'])
      .order('applied_at', { ascending: true })

    pendingBoothApplications = (boothApps ?? []) as PendingBoothApplicationRow[]
  }

  let pendingEtransfers: PendingEtransferApplication[] = []
  if (eventIds.length > 0) {
    const { data: etransferApps } = await supabase
      .from('booth_applications')
      .select(`
        *,
        vendor:profiles!booth_applications_vendor_id_fkey(full_name, email),
        event:events(id, name),
        category:categories(name)
      `)
      .in('event_id', eventIds)
      .eq('payment_method', 'ETRANSFER')
      .eq('application_payment_status', 'PENDING_REVIEW')
      .eq('status', 'approved')
      .order('applied_at', { ascending: false })

    if (etransferApps?.length) {
      const categoryPairs = etransferApps.map((app) => ({
        event_id: app.event_id,
        category_id: app.category_id,
      }))
      const uniqueEventIds = [...new Set(categoryPairs.map((p) => p.event_id))]
      const { data: limits } = await supabase
        .from('event_category_limits')
        .select('event_id, category_id, price_per_booth')
        .in('event_id', uniqueEventIds)

      const priceByKey = new Map(
        (limits ?? []).map((row) => [`${row.event_id}:${row.category_id}`, row.price_per_booth ?? 0])
      )

      pendingEtransfers = etransferApps.map((app) => ({
        ...(app as PendingEtransferApplication),
        booth_price_cents:
          priceByKey.get(`${app.event_id}:${app.category_id}`) ?? 0,
      }))
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Coordinator Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage your markets and vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/coordinator/square-connect">
            <Button variant="outline" size="sm">Connect Square</Button>
          </Link>
          <Link href="/coordinator/events/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />New Event
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}>
        <CoordinatorStats userId={user.id} />
      </Suspense>

      <PendingBoothApplicationsPanel
        applications={pendingBoothApplications}
        hasEvents={eventIds.length > 0}
        firstEventApplicationsHref={firstEventApplicationsHref}
      />

      <PendingEtransferPanel applications={pendingEtransfers} />

      <div>
        <h2 className="market-section-title mb-4">My Events</h2>
        <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>}>
          <MyEvents userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}
