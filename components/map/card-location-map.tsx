'use client'

import { useEffect, useRef, useState } from 'react'
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { GoogleMapsProvider } from '@/components/map/google-maps-provider'
import { MapResize } from '@/components/map/map-recenter'
import { openDirections } from '@/lib/shopper/geo'
import { cn } from '@/lib/utils'

interface CardLocationMapProps {
  lat: number
  lng: number
  locationName?: string | null
  address?: string | null
  className?: string
}

function CardLocationMapPlaceholder({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-24 items-center gap-2 rounded-xl border border-stone-200/70 bg-muted/30 px-3',
        className
      )}
    >
      <MapPin className="h-4 w-4 shrink-0 text-harvest-500" aria-hidden />
      <span className="line-clamp-2 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function CardLocationMapInner({
  lat,
  lng,
  label,
  address,
  locationName,
  className,
}: {
  lat: number
  lng: number
  label: string
  address?: string | null
  locationName?: string | null
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'group relative block h-24 w-full overflow-hidden rounded-xl border border-stone-200/70 bg-muted/20',
        className
      )}
      onClick={() => openDirections(lat, lng, address ?? locationName ?? undefined)}
      aria-label={`Open directions to ${label}`}
    >
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={{ lat, lng }}
        defaultZoom={15}
        mapId="popup-hub-map"
        gestureHandling="none"
        disableDefaultUI
        clickableIcons={false}
        keyboardShortcuts={false}
      >
        <MapResize />
        <AdvancedMarker position={{ lat, lng }} title={label}>
          <Pin background="#22c55e" borderColor="#ffffff" glyphColor="#ffffff" />
        </AdvancedMarker>
      </Map>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-1.5 text-left text-[10px] font-medium text-white">
        {label}
      </span>
    </button>
  )
}

export function CardLocationMap({
  lat,
  lng,
  locationName,
  address,
  className,
}: CardLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
  const label = locationName?.trim() || 'View location on map'

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!apiKey) {
    return <CardLocationMapPlaceholder label={label} className={className} />
  }

  return (
    <div ref={containerRef} data-swipe-back="off" className={cn('h-24 w-full', className)}>
      {!visible ? (
        <CardLocationMapPlaceholder label={label} />
      ) : (
        <GoogleMapsProvider
          apiKey={apiKey}
          libraries={['marker']}
          fallback={<CardLocationMapPlaceholder label={label} />}
          loading={<CardLocationMapPlaceholder label={label} />}
        >
          <CardLocationMapInner
            lat={lat}
            lng={lng}
            label={label}
            address={address}
            locationName={locationName}
          />
        </GoogleMapsProvider>
      )}
    </div>
  )
}
