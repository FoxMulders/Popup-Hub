import { createClient } from '@/lib/supabase/server'
import { EventMap } from '@/components/map/event-map'
import { EventCard } from '@/components/events/event-card'
import type { Event } from '@/types/database'

export async function DiscoverMarketsMap() {
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

export async function DiscoverMarketsList({ limit = 20 }: { limit?: number }) {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*, coordinator:profiles!events_coordinator_id_fkey(full_name, avatar_url)')
    .in('status', ['published', 'active'])
    .order('start_at', { ascending: true })
    .limit(limit)

  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-gray-500">No upcoming markets in the area yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event as Event} href={`/events/${event.id}`} />
      ))}
    </div>
  )
}
