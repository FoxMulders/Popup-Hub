'use client'

import { useEffect, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import type { Event } from '@/types/database'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'
import { MapPin, Clock, Calendar, Navigation, Map as MapIcon } from 'lucide-react'
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

function markerStyle(event: Event) {
  const isQuarterAuction =
    (event.listing_type ?? 'community_market') === 'garage_yard_sale'
  if (isQuarterAuction) {
    return {
      background: '#6366f1',
      glyph: '🪙',
      label: 'Quarter Auction',
    }
  }

  return {
    background: STATUS_COLORS[event.status] ?? '#f59e0b',
    glyph: '🎪',
    label: 'Community Market',
  }
}

function EventMapFallback({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
        <MapIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No events to show on the map.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="border-b bg-background/80 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Map unavailable</p>
        <p className="text-xs text-muted-foreground">
          Browse events below or open directions for each location.
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/events/${event.id}`}
                className="line-clamp-1 text-sm font-semibold text-foreground hover:underline"
              >
                {event.name}
              </Link>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location_name}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                {format(new Date(event.start_at), 'EEE, MMM d')}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                {format(new Date(event.start_at), 'h:mm a')} –{' '}
                {format(new Date(event.end_at), 'h:mm a')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Link href={`/events/${event.id}`}>
                <Button size="sm" variant="outline" className="text-xs">
                  View
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={() => openDirections(event.latitude, event.longitude, event.address)}
              >
                <Navigation className="h-3 w-3" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoogleEventMap({ events, center }: { events: Event[]; center: LatLng }) {
  const [selected, setSelected] = useState<Event | null>(null)
  const apiLoaded = useApiIsLoaded()
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (apiLoaded) {
      setLoadFailed(false)
      return
    }
    const timer = window.setTimeout(() => setLoadFailed(true), 10000)
    return () => window.clearTimeout(timer)
  }, [apiLoaded])

  if (loadFailed && !apiLoaded) {
    return <EventMapFallback events={events} />
  }

  return (
    <Map
      style={{ width: '100%', height: '100%' }}
      defaultCenter={center}
      defaultZoom={events.length > 0 ? 11 : 10}
      mapId="popup-hub-map"
      gestureHandling="greedy"
    >
      {events.map((event) => {
        const style = markerStyle(event)
        return (
          <AdvancedMarker
            key={event.id}
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={() => setSelected(event)}
          >
            <Pin
              background={style.background}
              borderColor="white"
              glyphColor="white"
              glyph={style.glyph}
            />
          </AdvancedMarker>
        )
      })}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude, lng: selected.longitude }}
          onCloseClick={() => setSelected(null)}
          pixelOffset={[0, -40]}
        >
          <div className="w-56 space-y-2 p-1">
            {selected.cover_image_url && (
              <ExpandableImage
                src={selected.cover_image_url}
                alt={selected.name}
                className="h-28 w-full rounded-lg object-contain bg-canvas"
              />
            )}
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold leading-tight text-foreground">{selected.name}</h3>
                <Badge className="shrink-0 text-[10px] capitalize">{selected.status}</Badge>
              </div>
              <Badge variant="outline" className="mt-1 text-[10px]">
                {markerStyle(selected).label}
              </Badge>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {selected.location_name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                {format(new Date(selected.start_at), 'EEE, MMM d')}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
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
  )
}

export function EventMap({ events, center: centerProp }: EventMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()

  const center =
    centerProp ??
    (events.length > 0
      ? { lat: events[0].latitude, lng: events[0].longitude }
      : DEFAULT_REGION)

  return (
    <div className="relative isolate z-0 h-full w-full overflow-hidden">
      {!apiKey ? (
        <EventMapFallback events={events} />
      ) : (
        <APIProvider apiKey={apiKey}>
          <GoogleEventMap events={events} center={center} />
        </APIProvider>
      )}
    </div>
  )
}
