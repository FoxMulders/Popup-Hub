'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventMap } from '@/components/map/event-map'
import { DiscoverEventCards } from '@/components/shopper/discover-event-cards'
import { MarketAreaFilter } from '@/components/markets/market-area-filter'
import { useMarketAreaFilter } from '@/hooks/use-market-area-filter'
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
import type { Event, EventListingType } from '@/types/database'
import { cn } from '@/lib/utils'

interface DiscoverScreenProps {
  events: Event[]
  vendorCounts: Record<string, number>
  favoriteIds: string[]
}

type DateFilterPreset = 'today' | 'tomorrow' | 'weekend' | 'custom'

function weekendAnchorDate(base: Date): Date {
  const day = base.getDay()
  return addDays(base, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
}

export function DiscoverScreen({ events, vendorCounts, favoriteIds }: DiscoverScreenProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'list' | 'map'>('list')
  const {
    origin,
    radiusKm,
    setRadiusKm,
    locationLabel,
    locating,
    useMyLocation,
  } = useMarketAreaFilter()

  const listingScope = (searchParams.get('scope') as EventListingType | null) ?? 'community_market'
  const datePreset = (searchParams.get('when') as DateFilterPreset | null) ?? 'today'
  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get('date')),
    [searchParams]
  )

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

  const setListingScope = useCallback(
    (scope: EventListingType) => replaceParams({ scope }),
    [replaceParams]
  )

  const setDatePreset = useCallback(
    (preset: DateFilterPreset, date?: Date) => {
      const today = startOfDay(new Date())
      const nextDate =
        date ??
        (preset === 'today'
          ? today
          : preset === 'tomorrow'
            ? addDays(today, 1)
            : preset === 'weekend'
              ? weekendAnchorDate(today)
              : selectedDate)

      replaceParams({
        when: preset,
        date: formatDateParam(nextDate),
      })
    },
    [replaceParams, selectedDate]
  )

  const filtered = useMemo(() => {
    const scoped = filterEventsByListingType(events, listingScope)
    const byDate =
      datePreset === 'weekend'
        ? filterEventsByWeekend(scoped, selectedDate)
        : filterEventsByDate(scoped, selectedDate)
    const withMeta: EventWithMeta[] = byDate.map((e) => ({
      ...e,
      vendor_count: vendorCounts[e.id] ?? 0,
    }))
    const sorted = sortEventsByDistance(withMeta, origin)
    return filterEventsByRadius(sorted, radiusKm)
  }, [events, listingScope, datePreset, selectedDate, origin, radiusKm, vendorCounts])

  const dateSummary = useMemo(() => {
    if (datePreset === 'weekend') {
      const [sat, sun] = getWeekendDates(selectedDate)
      return `${format(sat, 'EEEE, MMMM d')} – ${format(sun, 'MMMM d, yyyy')}`
    }
    return format(selectedDate, 'EEEE, MMMM d, yyyy')
  }, [datePreset, selectedDate])

  const scopeLabel =
    listingScope === 'garage_yard_sale' ? 'Garage & Yard Sales' : 'Community Markets'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:py-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Discover {scopeLabel}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {listingScope === 'garage_yard_sale'
            ? 'Find neighborhood garage and yard sales near you'
            : 'Find popup markets near you — browse vendors before you go'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Event type
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={listingScope === 'community_market' ? 'default' : 'outline'}
            className="min-h-10"
            onClick={() => setListingScope('community_market')}
          >
            🎪 Community Markets
          </Button>
          <Button
            type="button"
            size="sm"
            variant={listingScope === 'garage_yard_sale' ? 'default' : 'outline'}
            className="min-h-10"
            onClick={() => setListingScope('garage_yard_sale')}
          >
            🏡 Garage &amp; Yard Sales
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          When
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'today' ? 'default' : 'outline'}
            className="min-h-10"
            onClick={() => setDatePreset('today')}
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'tomorrow' ? 'default' : 'outline'}
            className="min-h-10"
            onClick={() => setDatePreset('tomorrow')}
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            size="sm"
            variant={datePreset === 'weekend' ? 'default' : 'outline'}
            className="min-h-10"
            onClick={() => setDatePreset('weekend')}
          >
            This Weekend
          </Button>
          <label
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm',
              datePreset === 'custom'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-transparent'
            )}
          >
            <span>Select Date 📅</span>
            <input
              type="date"
              className={cn(
                'border-0 bg-transparent outline-none',
                datePreset === 'custom' ? 'text-primary-foreground' : ''
              )}
              value={formatDateParam(selectedDate)}
              onChange={(e) => {
                if (e.target.value) setDatePreset('custom', parseDateParam(e.target.value))
              }}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {scopeLabel.toLowerCase()} for{' '}
          <span className="font-medium text-foreground">{dateSummary}</span>
        </p>
      </div>

      <MarketAreaFilter
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        locationLabel={locationLabel}
        locating={locating}
        onUseMyLocation={useMyLocation}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'map')}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white py-16 text-center">
          <p className="text-muted-foreground">
            No {scopeLabel.toLowerCase()} on this day within your area. Try another date or widen the radius.
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

      {view === 'list' && filtered.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border shadow-sm md:block md:h-[360px]">
          <EventMap events={filtered} center={origin} />
        </div>
      )}
    </div>
  )
}
