'use client'

import { useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps'
import type { Event } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'
import { MapPin, Clock, Calendar, Navigation } from 'lucide-react'
import { openDirections, type LatLng } from '@/lib/shopper/geo'
import { DEFAULT_REGION } from '@/lib/shopper/geo'

interface EventMapProps {
  events: Event[]
  center?: LatLng
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  published: '#f59e0b',
  completed: '#9ca3af',
}

export function EventMap({ events, center: centerProp }: EventMapProps) {
  const [selected, setSelected] = useState<Event | null>(null)

  const center =
    centerProp ??
    (events.length > 0
      ? { lat: events[0].latitude, lng: events[0].longitude }
      : DEFAULT_REGION)

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={center}
        defaultZoom={events.length > 0 ? 11 : 10}
        mapId="popup-hub-map"
        gestureHandling="greedy"
      >
        {events.map((event) => (
          <AdvancedMarker
            key={event.id}
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={() => setSelected(event)}
          >
            <Pin
              background={STATUS_COLORS[event.status] ?? '#f59e0b'}
              borderColor="white"
              glyphColor="white"
            />
          </AdvancedMarker>
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: selected.latitude, lng: selected.longitude }}
            onCloseClick={() => setSelected(null)}
            pixelOffset={[0, -40]}
          >
            <div className="w-56 space-y-2 p-1">
              {selected.cover_image_url && (
                <img
                  src={selected.cover_image_url}
                  alt={selected.name}
                  className="h-28 w-full rounded-lg object-cover"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold leading-tight text-gray-900">{selected.name}</h3>
                  <Badge
                    className={`capitalize text-[10px] ${
                      selected.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selected.status}
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {selected.location_name}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {format(new Date(selected.start_at), 'EEE, MMM d')}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(new Date(selected.start_at), 'h:mm a')} –{' '}
                  {format(new Date(selected.end_at), 'h:mm a')}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/events/${selected.id}`} className="flex-1">
                  <Button size="sm" className="w-full bg-forest text-xs text-white hover:bg-forest-deep">
                    View
                  </Button>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() =>
                    openDirections(selected.latitude, selected.longitude, selected.address)
                  }
                >
                  <Navigation className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  )
}
