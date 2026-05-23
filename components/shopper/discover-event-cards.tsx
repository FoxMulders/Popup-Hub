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
}

export function DiscoverEventCards({
  events,
  selectedDate,
  favoriteIds,
}: DiscoverEventCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <div key={event.id} className="relative">
          <EventCard
            event={event}
            href={`/events/${event.id}`}
            hoursLabel={getEventHoursForDate(event, selectedDate)}
            distanceLabel={
              event.distance_km != null ? formatDistance(event.distance_km) : undefined
            }
            vendorCount={event.vendor_count}
            actions={
              <div className="flex items-center gap-2">
                <FavoriteButton
                  eventId={event.id}
                  initialFavorited={favoriteIds.includes(event.id)}
                  size="sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openDirections(event.latitude, event.longitude, event.address)
                  }}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Directions
                </Button>
              </div>
            }
          />
        </div>
      ))}
    </div>
  )
}
