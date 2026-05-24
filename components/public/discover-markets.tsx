import { EventMap } from '@/components/map/event-map'
import { EventCard } from '@/components/events/event-card'
import {
  getCachedDiscoverMarkets,
} from '@/lib/queries/cached-public-markets'
import type { Event } from '@/types/database'

export async function DiscoverMarketsMap() {
  const events = await getCachedDiscoverMarkets()

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border shadow-sm">
      <EventMap events={events} />
    </div>
  )
}

export async function DiscoverMarketsList({ limit = 20 }: { limit?: number }) {
  const events = await getCachedDiscoverMarkets()
  const visible = events.slice(0, limit)

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-gray-500">No upcoming markets in the area yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((event) => (
        <EventCard key={event.id} event={event as Event} href={`/events/${event.id}`} />
      ))}
    </div>
  )
}
