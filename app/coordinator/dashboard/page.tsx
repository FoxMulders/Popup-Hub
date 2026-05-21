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

async function CoordinatorStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: myEventIds } = await supabase.from('events').select('id').eq('coordinator_id', userId)
  const eventIds = myEventIds?.map((e) => e.id) ?? []

  const [{ count: totalEvents }, { count: pendingApplications }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('coordinator_id', userId),
    eventIds.length > 0
      ? supabase.from('booth_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('event_id', eventIds)
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Events</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-500" />
          <span className="text-2xl font-bold">{totalEvents ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Pending Applications</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-500" />
          <span className="text-2xl font-bold">{pendingApplications ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Square Payouts</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <Link href="/coordinator/square-connect">
            <Button variant="link" size="sm" className="h-auto p-0 text-sm text-green-600">Connect Square →</Button>
          </Link>
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
      <div className="rounded-2xl border bg-white py-16 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-gray-500 text-sm">No events created yet.</p>
        <Link href="/coordinator/events/new">
          <Button size="sm" className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">Create First Event</Button>
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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coordinator Dashboard</h1>
          <p className="mt-1 text-gray-500">Manage your markets and vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/coordinator/square-connect">
            <Button variant="outline" size="sm">Connect Square</Button>
          </Link>
          <Link href="/coordinator/events/new">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" size="sm">
              <Plus className="mr-2 h-4 w-4" />New Event
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}>
        <CoordinatorStats userId={user.id} />
      </Suspense>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">My Events</h2>
        <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>}>
          <MyEvents userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}
