'use client'

import { EventMap } from '@/components/map/event-map'
import type { Event } from '@/types/database'

interface VendorEventVenueMapProps {
  event: Pick<Event, 'id' | 'name' | 'latitude' | 'longitude' | 'status' | 'location_name' | 'address'>
}

export function VendorEventVenueMap({ event }: VendorEventVenueMapProps) {
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) {
    return null
  }

  return (
    <section className="rounded-2xl border bg-white p-6" aria-labelledby="vendor-venue-map-heading">
      <h2 id="vendor-venue-map-heading" className="mb-2 text-lg font-semibold text-foreground">
        Market location
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {event.location_name}
        {event.address ? ` — ${event.address}` : ''}
      </p>
      <div className="h-[min(50vh,320px)] overflow-hidden rounded-xl border">
        <EventMap events={[event as Event]} center={{ lat: event.latitude, lng: event.longitude }} />
      </div>
    </section>
  )
}
