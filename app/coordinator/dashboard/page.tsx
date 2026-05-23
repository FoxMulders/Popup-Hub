import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard } from '@/components/events/event-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Calendar, Clock, DollarSign } from 'lucide-react'
import type { Event } from '@/types/database'
import { VendorAccessRequestsPanel } from '@/components/coordinator/vendor-access-requests-panel'

async function CoordinatorStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: myEventIds } = await supabase.from('events').select('id').eq('coordinator_id', userId)
  const eventIds = myEventIds?.map((e) => e.id) ?? []

  const [
    { count: totalEvents },
    { count: pendingApplications },
    { data: revenueRows },
    { data: profile },
  ] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('coordinator_id', userId),
    eventIds.length > 0
      ? supabase.from('booth_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('event_id', eventIds)
      : Promise.resolve({ count: 0 }),
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
  const revenueFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalRevenueCents / 100)

  const squareConnected =
    profile?.payout_onboarding_status === 'complete' && !!profile.payout_account_id

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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Square Payouts</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          {squareConnected ? (
            <span className="text-sm font-medium text-sage-700">Connected</span>
          ) : (
            <Link href="/coordinator/square-connect">
              <Button variant="link" size="sm" className="h-auto p-0 text-sm text-sage-700">Connect Square →</Button>
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
    .order('created_at', { ascending: false })
    .limit(9)

  if (!events || events.length === 0) {
    return (
      <div className="market-panel py-16 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        <p className="text-muted-foreground text-sm">No events created yet.</p>
        <Link href="/coordinator/events/new">
          <Button size="sm" className="mt-4">Create First Event</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(events as Event[]).map((event) => (
        <EventCard key={event.id} event={event} href={`/coordinator/events/${event.id}`} />
      ))}
    </div>
  )
}

export default async function CoordinatorDashboard() {
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
      <div className="flex items-center justify-between">
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
