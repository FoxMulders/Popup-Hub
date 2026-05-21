import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { EventMap } from '@/components/map/event-map'
import { EventCard } from '@/components/events/event-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event } from '@/types/database'

async function MapSection() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .in('status', ['published', 'active'])
    .order('start_at', { ascending: true })

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border shadow-sm">
      <EventMap events={(events as Event[]) ?? []} />
    </div>
  )
}

async function EventList() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*, coordinator:profiles(full_name, avatar_url)')
    .in('status', ['published', 'active'])
    .order('start_at', { ascending: true })
    .limit(20)

  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-gray-500">No upcoming markets found in your area yet.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event as Event} href={`/shopper/events/${event.id}`} />
      ))}
    </div>
  )
}

export default function ShopperDashboard() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Discover Markets</h1>
        <p className="mt-1 text-gray-500">Find local popup markets happening near you</p>
      </div>

      <Suspense
        fallback={
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        }
      >
        <MapSection />
      </Suspense>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Upcoming Markets</h2>
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          }
        >
          <EventList />
        </Suspense>
      </div>
    </div>
  )
}
