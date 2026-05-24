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
import { VendorAccessRequestsPanel } from '@/components/coordinator/vendor-access-requests-panel'
import {
  CoordinatorStripePayout,
  CoordinatorStripeReturnNotice,
} from '@/components/coordinator/coordinator-stripe-payout'

async function CoordinatorStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: myEventIds } = await supabase.from('events').select('id').eq('coordinator_id', userId)
  const eventIds = myEventIds?.map((e) => e.id) ?? []

  const [{ count: totalEvents }, { count: pendingApplications }, { data: revenueRows }] =
    await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('coordinator_id', userId),
      eventIds.length > 0
        ? supabase
            .from('booth_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .in('event_id', eventIds)
        : Promise.resolve({ count: 0 }),
      supabase
        .from('platform_transactions')
        .select('organizer_payout_amount')
        .eq('coordinator_id', userId)
        .eq('status', 'completed'),
    ])

  const totalRevenueCents =
    revenueRows?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0
  const revenueFormatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(totalRevenueCents / 100)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-forest" />
          <span className="text-2xl font-bold">{totalEvents ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Applications</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-harvest-500" />
          <span className="text-2xl font-bold">{pendingApplications ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Booth Revenue</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-sage-600" />
          <span className="text-2xl font-bold">{revenueFormatted}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Stripe Payouts</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <CoordinatorStripePayout userId={userId} variant="card" />
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

export default async function CoordinatorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accessRequests } = await supabase
    .from('vendor_access_requests')
    .select('*, shopper:profiles!vendor_access_requests_shopper_id_fkey(full_name, email)')
    .eq('coordinator_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Coordinator Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage your markets and vendors</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <CoordinatorStripeReturnNotice userId={user.id} status={status} />
          <div className="flex items-center gap-2">
            <CoordinatorStripePayout userId={user.id} />
            <Link href="/coordinator/events/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />New Event
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}>
        <CoordinatorStats userId={user.id} />
      </Suspense>

      <VendorAccessRequestsPanel requests={accessRequests ?? []} />

      <div>
        <h2 className="market-section-title mb-4">My Events</h2>
        <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>}>
          <MyEvents userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}
