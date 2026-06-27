'use client'

import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { buildStaticMapUrl } from '@/lib/maps/static-map'
import { openDirections } from '@/lib/shopper/geo'
import { cn } from '@/lib/utils'

interface StaticEventMapProps {
  lat: number
  lng: number
  locationName?: string | null
  address?: string | null
  className?: string
}

export function StaticEventMap({
  lat,
  lng,
  locationName,
  address,
  className,
}: StaticEventMapProps) {
  const [failed, setFailed] = useState(false)

  const mapUrl = useMemo(
    () =>
      buildStaticMapUrl({
        lat,
        lng,
        width: 400,
        height: 96,
        zoom: 15,
      }),
    [lat, lng]
  )

  const label = locationName?.trim() || 'View location on map'

  if (!mapUrl || failed) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapUrl}
        alt=""
        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-1.5 text-left text-[10px] font-medium text-white">
        {label}
      </span>
    </button>
  )
}
