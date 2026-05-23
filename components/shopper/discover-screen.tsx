'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, startOfDay } from 'date-fns'
import { MapPin, Navigation, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventMap } from '@/components/map/event-map'
import { DiscoverEventCards } from '@/components/shopper/discover-event-cards'
import {
  DEFAULT_REGION,
  formatDistance,
  type LatLng,
} from '@/lib/shopper/geo'
import {
  filterEventsByDate,
  filterEventsByRadius,
  formatDateParam,
  parseDateParam,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'
import { cn } from '@/lib/utils'

const RADIUS_OPTIONS = [
  { label: 'Any distance', km: null },
  { label: '10 km', km: 10 },
  { label: '25 km', km: 25 },
] as const

const STORAGE_KEY = 'popup-hub:last-location'

interface DiscoverScreenProps {
  events: Event[]
  vendorCounts: Record<string, number>
  favoriteIds: string[]
}

export function DiscoverScreen({ events, vendorCounts, favoriteIds }: DiscoverScreenProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [origin, setOrigin] = useState<LatLng>(DEFAULT_REGION)
  const [locating, setLocating] = useState(false)
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  const [locationLabel, setLocationLabel] = useState('Edmonton area')

  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get('date')),
    [searchParams]
  )

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as LatLng & { label?: string }
        setOrigin({ lat: parsed.lat, lng: parsed.lng })
        if (parsed.label) setLocationLabel(parsed.label)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const setDate = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('date', formatDateParam(date))
      router.replace(`/discover?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setOrigin(next)
        setLocationLabel('Near you')
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, label: 'Near you' }))
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [])

  const filtered = useMemo(() => {
    const byDate = filterEventsByDate(events, selectedDate)
    const withMeta: EventWithMeta[] = byDate.map((e) => ({
      ...e,
      vendor_count: vendorCounts[e.id] ?? 0,
    }))
    const sorted = sortEventsByDistance(withMeta, origin)
    return filterEventsByRadius(sorted, radiusKm)
  }, [events, selectedDate, origin, radiusKm, vendorCounts])

  const dateChips = useMemo(() => {
    const today = startOfDay(new Date())
    return [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: addDays(today, 1) },
      {
        label: 'This weekend',
        date: (() => {
          const day = today.getDay()
          const sat = addDays(today, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
          return sat
        })(),
      },
    ]
  }, [])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:py-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Discover Markets
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find popup markets near you — browse vendors before you go
        </p>
      </div>

      {/* Date picker */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          When
        </p>
        <div className="flex flex-wrap gap-2">
          {dateChips.map(({ label, date }) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={formatDateParam(selectedDate) === formatDateParam(date) ? 'default' : 'outline'}
              className="min-h-10"
              onClick={() => setDate(date)}
            >
              {label}
            </Button>
          ))}
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm">
            <span className="text-muted-foreground">Pick date</span>
            <input
              type="date"
              className="border-0 bg-transparent outline-none"
              value={formatDateParam(selectedDate)}
              onChange={(e) => {
                if (e.target.value) setDate(parseDateParam(e.target.value))
              }}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing markets for{' '}
          <span className="font-medium text-foreground">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </p>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Area
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Use my location
          </Button>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {locationLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map(({ label, km }) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={radiusKm === km ? 'secondary' : 'outline'}
              className="min-h-9"
              onClick={() => setRadiusKm(km)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Map / List toggle — mobile first */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'map')}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white py-16 text-center">
          <p className="text-muted-foreground">
            No markets on this day within your area. Try another date or widen the radius.
          </p>
        </div>
      ) : view === 'map' ? (
        <div
          className={cn(
            'overflow-hidden rounded-2xl border shadow-sm',
            'h-[min(70vh,520px)] md:h-[480px]'
          )}
        >
          <EventMap events={filtered} center={origin} />
        </div>
      ) : (
        <DiscoverEventCards
          events={filtered}
          selectedDate={selectedDate}
          favoriteIds={favoriteIds}
        />
      )}

      {/* Desktop: show map below list when in list mode */}
      {view === 'list' && filtered.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border shadow-sm md:block md:h-[360px]">
          <EventMap events={filtered} center={origin} />
        </div>
      )}
    </div>
  )
}
