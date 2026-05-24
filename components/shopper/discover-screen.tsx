'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventMap } from '@/components/map/event-map'
import { DiscoverEventCards } from '@/components/shopper/discover-event-cards'
import { MarketAreaFilter } from '@/components/markets/market-area-filter'
import { useMarketAreaFilter } from '@/hooks/use-market-area-filter'
import {
  discoverDateSearchParams,
  resolveDiscoverFilterDate,
  type DateFilterPreset,
} from '@/lib/shopper/discover-date'
import {
  filterEventsByDate,
  filterEventsByListingType,
  filterEventsByRadius,
  filterEventsByWeekend,
  formatDateParam,
  getWeekendDates,
  parseDateParam,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'
import { cn } from '@/lib/utils'
import { Gavel } from 'lucide-react'

interface DiscoverScreenProps {
  events: Event[]
  vendorCounts: Record<string, number>
  favoriteIds: string[]
  activeAuctionByEventId?: Record<string, string>
}

export function DiscoverScreen({
  events,
  vendorCounts,
  favoriteIds,
  activeAuctionByEventId = {},
}: DiscoverScreenProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'list' | 'map'>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'list'
  )
  const {
    origin,
    radiusKm,
    setRadiusKm,
    locationLabel,
    locating,
    useMyLocation,
  } = useMarketAreaFilter()

  const { preset: datePreset, date: filterDate } = useMemo(
    () => resolveDiscoverFilterDate(searchParams.get('when'), searchParams.get('date')),
    [searchParams]
  )

  const liveAuctionsOnly = searchParams.get('live') === 'auctions'

  const replaceParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value == null) params.delete(key)
        else params.set(key, value)
      }
      router.replace(`/discover?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const setDatePreset = useCallback(
    (preset: DateFilterPreset, date?: Date) => {
      const params = discoverDateSearchParams(preset, date ?? filterDate)
      replaceParams({ when: params.when, date: params.date })
    },
    [replaceParams, filterDate]
  )

  const setViewMode = useCallback(
    (next: 'list' | 'map') => {
      setView(next)
      replaceParams({ view: next })
    },
    [replaceParams]
  )

  const filtered = useMemo(() => {
    const scoped = filterEventsByListingType(events, 'community_market')
    const byDate =
      datePreset === 'weekend'
        ? filterEventsByWeekend(scoped, filterDate)
        : filterEventsByDate(scoped, filterDate)
    const withMeta: EventWithMeta[] = byDate.map((e) => ({
      ...e,
      vendor_count: vendorCounts[e.id] ?? 0,
    }))
    const sorted = sortEventsByDistance(withMeta, origin)
    const inRadius = filterEventsByRadius(sorted, radiusKm)
    if (!liveAuctionsOnly) return inRadius
    return inRadius.filter((e) => activeAuctionByEventId[e.id] != null)
  }, [events, datePreset, filterDate, origin, radiusKm, vendorCounts, liveAuctionsOnly, activeAuctionByEventId])

  const dateSummary = useMemo(() => {
    if (datePreset === 'weekend') {
      const [sat, sun] = getWeekendDates(filterDate)
      return `${format(sat, 'EEEE, MMMM d')} – ${format(sun, 'MMMM d, yyyy')}`
    }
    return format(filterDate, 'EEEE, MMMM d, yyyy')
  }, [datePreset, filterDate])

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden px-4 py-6 sm:max-w-7xl sm:py-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Discover Community Markets
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find popup markets near you — browse vendors before you go
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          When
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'today' ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation"
            onClick={() => setDatePreset('today')}
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'tomorrow' ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation"
            onClick={() => setDatePreset('tomorrow')}
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'weekend' ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation"
            onClick={() => setDatePreset('weekend')}
          >
            This Weekend
          </Button>
          <label
            className={cn(
              'inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-lg border px-3 text-sm',
              datePreset === 'custom'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-transparent'
            )}
          >
            <span>Select Date</span>
            <input
              type="date"
              className={cn(
                'min-h-9 border-0 bg-transparent outline-none touch-manipulation',
                datePreset === 'custom' ? 'text-primary-foreground' : ''
              )}
              value={formatDateParam(filterDate)}
              onChange={(e) => {
                if (e.target.value) {
                  setDatePreset('custom', parseDateParam(e.target.value))
                }
              }}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant={liveAuctionsOnly ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation gap-1.5"
            onClick={() => replaceParams({ live: liveAuctionsOnly ? null : 'auctions' })}
          >
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            Live auctions
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {liveAuctionsOnly ? (
            <>
              Showing markets with a{' '}
              <span className="font-medium text-foreground">live quarter auction</span> for{' '}
              <span className="font-medium text-foreground">{dateSummary}</span>
            </>
          ) : (
            <>
              Showing community markets for{' '}
              <span className="font-medium text-foreground">{dateSummary}</span>
            </>
          )}
        </p>
      </div>

      <div className="mt-4">
        <MarketAreaFilter
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          locationLabel={locationLabel}
          locating={locating}
          onUseMyLocation={useMyLocation}
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setViewMode(v as 'list' | 'map')} className="mt-4">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list" className="min-h-11 touch-manipulation">
            List
          </TabsTrigger>
          <TabsTrigger value="map" className="min-h-11 touch-manipulation">
            Map
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-white py-16 text-center">
          <p className="text-muted-foreground">
            {liveAuctionsOnly
              ? 'No live quarter auctions on this day within your area. Try another date or turn off the Live auctions filter.'
              : 'No community markets on this day within your area. Try another date or widen the radius.'}
          </p>
        </div>
      ) : view === 'map' ? (
        <div
          className={cn(
            'relative isolate z-0 mt-4 overflow-hidden rounded-2xl border shadow-sm',
            'h-[min(70vh,520px)] md:h-[480px]'
          )}
        >
          <EventMap events={filtered} center={origin} />
        </div>
      ) : (
        <DiscoverEventCards
          events={filtered}
          selectedDate={filterDate}
          favoriteIds={favoriteIds}
          activeAuctionByEventId={activeAuctionByEventId}
        />
      )}
    </div>
  )
}
