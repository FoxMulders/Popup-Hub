'use client'

import { formatDistance, openDirections } from '@/lib/shopper/geo'
import { getEventHoursForDate, type EventWithMeta } from '@/lib/shopper/events'
import { EventCard } from '@/components/events/event-card'
import { FavoriteButton } from '@/components/shopper/favorite-button'
import { Button } from '@/components/ui/button'
import { Navigation } from 'lucide-react'

interface DiscoverEventCardsProps {
  events: EventWithMeta[]
  selectedDate: Date
  favoriteIds: string[]
  activeAuctionByEventId?: Record<string, string>
}

export function DiscoverEventCards({
  events,
  selectedDate,
  favoriteIds,
  activeAuctionByEventId = {},
}: DiscoverEventCardsProps) {
  return (
    <div className="mt-4 grid max-w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <div key={event.id} className="relative max-w-full">
          <div className="absolute right-3 top-3 z-10">
            <FavoriteButton
              eventId={event.id}
              initialFavorited={favoriteIds.includes(event.id)}
              size="sm"
              className="h-9 w-9 shrink-0 rounded-full border-white/80 bg-white/95 p-0 shadow-sm"
              iconOnly
            />
          </div>
          <EventCard
            event={event}
            href={`/events/${event.id}`}
            selectedDate={selectedDate}
            hoursLabel={getEventHoursForDate(event, selectedDate)}
            distanceLabel={
              event.distance_km != null ? formatDistance(event.distance_km) : undefined
            }
            vendorCount={event.vendor_count}
            liveAuctionId={activeAuctionByEventId[event.id]}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-10 w-full gap-1.5 touch-manipulation"
                onClick={() =>
                  openDirections(event.latitude, event.longitude, event.address ?? event.location_name)
                }
              >
                <Navigation className="h-3.5 w-3.5" />
                Directions
              </Button>
            }
          />
        </div>
      ))}
    </div>
  )
}
