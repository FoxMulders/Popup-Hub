'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
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
  filterEventsByDateRange,
  filterEventsByListingType,
  filterEventsByRadius,
  filterEventsByWeekend,
  getThisMonthEndDate,
  getThisWeekEndDate,
  getWeekendDates,
  sortEventsByDistance,
  countUpcomingEventsInRadius,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { Event } from '@/types/database'
import { DiscoverEmptyState } from '@/components/shopper/discover-empty-state'
import { DiscoverWhenFilter } from '@/components/shopper/discover-when-filter'
import { SitePageBand } from '@/components/layout/site-page-band'
import { clampSliderRadiusKm } from '@/lib/markets/distance-radius'
import { cn } from '@/lib/utils'

interface DiscoverScreenProps {
  events: Event[]
  vendorCounts: Record<string, number>
  favoriteIds: string[]
  activeAuctionByEventId?: Record<string, string>
  marketAlertsHref?: string
}

export function DiscoverScreen({
  events,
  vendorCounts,
  favoriteIds,
  activeAuctionByEventId = {},
  marketAlertsHref,
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
    showDeviceLocationPin,
    requestMyLocation,
    setOriginFromPlace,
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

  const handleUseMyLocation = useCallback(() => {
    requestMyLocation()
    setViewMode('map')
  }, [requestMyLocation, setViewMode])

  const filtered = useMemo(() => {
    const listingType = liveAuctionsOnly ? 'garage_yard_sale' : 'community_market'
    const scoped = filterEventsByListingType(events, listingType)
    const byDate =
      datePreset === 'weekend' || datePreset === 'next_weekend'
        ? filterEventsByWeekend(scoped, filterDate)
        : datePreset === 'this_week'
          ? filterEventsByDateRange(scoped, filterDate, getThisWeekEndDate(filterDate))
          : datePreset === 'this_month'
            ? filterEventsByDateRange(scoped, filterDate, getThisMonthEndDate(filterDate))
            : filterEventsByDate(scoped, filterDate)
    const withMeta: EventWithMeta[] = byDate.map((e) => ({
      ...e,
      vendor_count: vendorCounts[e.id] ?? 0,
    }))
    const sorted = sortEventsByDistance(withMeta, origin)
    return filterEventsByRadius(sorted, radiusKm)
  }, [events, datePreset, filterDate, origin, radiusKm, vendorCounts, liveAuctionsOnly])

  const upcomingInAreaCount = useMemo(
    () =>
      countUpcomingEventsInRadius(
        events,
        origin,
        radiusKm,
        undefined,
        60,
        liveAuctionsOnly ? 'garage_yard_sale' : 'community_market'
      ),
    [events, origin, radiusKm, liveAuctionsOnly]
  )

  const widenRadius = useCallback(() => {
    if (radiusKm == null) return
    setRadiusKm(clampSliderRadiusKm(radiusKm + 25))
  }, [radiusKm, setRadiusKm])

  const dateSummary = useMemo(() => {
    if (datePreset === 'weekend' || datePreset === 'next_weekend') {
      const [sat, sun] = getWeekendDates(filterDate)
      const prefix = datePreset === 'next_weekend' ? 'Next weekend' : 'This weekend'
      return `${prefix}: ${format(sat, 'EEEE, MMMM d')} – ${format(sun, 'MMMM d, yyyy')}`
    }
    if (datePreset === 'this_week') {
      const end = getThisWeekEndDate(filterDate)
      return `This week: ${format(filterDate, 'EEEE, MMMM d')} – ${format(end, 'MMMM d, yyyy')}`
    }
    if (datePreset === 'this_month') {
      const end = getThisMonthEndDate(filterDate)
      return `This month: ${format(filterDate, 'MMMM d')} – ${format(end, 'MMMM d, yyyy')}`
    }
    return format(filterDate, 'EEEE, MMMM d, yyyy')
  }, [datePreset, filterDate])

  return (
    <>
      <SitePageBand
        eyebrow="Discover"
        title={liveAuctionsOnly ? 'Quarter auctions near you' : 'Community markets near you'}
        description={
          liveAuctionsOnly
            ? 'Live quarter auction markets — drop quarters and win vendor prizes'
            : 'See confirmed vendors and plan your weekend before you go'
        }
      />

      <div className="mx-auto w-full max-w-full overflow-x-hidden px-4 py-6 sm:max-w-7xl sm:py-8">
      <div className="rounded-2xl border border-stone-200/70 bg-white/90 p-4 shadow-sm sm:p-5">
        <DiscoverWhenFilter
          datePreset={datePreset}
          filterDate={filterDate}
          liveAuctionsOnly={liveAuctionsOnly}
          onPresetChange={setDatePreset}
          onLiveAuctionsToggle={() => replaceParams({ live: liveAuctionsOnly ? null : 'auctions' })}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          {liveAuctionsOnly ? (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">quarter auction markets</span> for{' '}
              <span className="font-medium text-foreground">{dateSummary}</span>
            </>
          ) : (
            <>
              Showing community markets for{' '}
              <span className="font-medium text-foreground">{dateSummary}</span>
            </>
          )}
        </p>

        <div className="mt-4 border-t border-stone-200/70 pt-4">
          <MarketAreaFilter
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            locationLabel={locationLabel}
            locating={locating}
            onUseMyLocation={handleUseMyLocation}
            onAddressSelect={setOriginFromPlace}
          />
        </div>
      </div>

      <div
        className="mt-6 inline-flex w-full max-w-xs rounded-full border border-stone-200/70 bg-muted/60 p-1"
        role="tablist"
        aria-label="Discover view"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          variant={view === 'list' ? 'default' : 'ghost'}
          className={cn(
            'min-h-10 flex-1 touch-manipulation rounded-full shadow-none',
            view === 'list' && 'shadow-sm'
          )}
          onClick={() => setViewMode('list')}
        >
          List
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={view === 'map'}
          variant={view === 'map' ? 'default' : 'ghost'}
          className={cn(
            'min-h-10 flex-1 touch-manipulation rounded-full shadow-none',
            view === 'map' && 'shadow-sm'
          )}
          onClick={() => setViewMode('map')}
        >
          Map
        </Button>
      </div>

      {view === 'map' ? (
        // The map stays mounted even when zero markets match the current
        // filters so the user keeps spatial context (their pinned origin,
        // surrounding geography) while they widen the radius or change
        // the date. The empty-state copy is overlaid on top of the map
        // instead of replacing it.
        <div
          className={cn(
            'relative isolate z-0 mt-4 overflow-hidden rounded-2xl border shadow-sm [touch-action:auto]',
            'h-[min(70dvh,520px)] md:h-[480px]'
          )}
        >
          <EventMap
            events={filtered}
            center={origin}
            radiusKm={radiusKm}
            showUserOriginPin={showDeviceLocationPin}
          />
          {filtered.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center sm:inset-x-6">
              <DiscoverEmptyState
                compact
                liveAuctionsOnly={liveAuctionsOnly}
                datePreset={datePreset}
                radiusKm={radiusKm}
                upcomingInAreaCount={upcomingInAreaCount}
                onTryPreset={setDatePreset}
                onWidenRadius={widenRadius}
                onShowEverywhere={() => setRadiusKm(null)}
                onClearLiveAuctionFilter={() => replaceParams({ live: null })}
                marketAlertsHref={marketAlertsHref}
                className="pointer-events-auto sm:max-w-lg"
              />
            </div>
          ) : null}
        </div>
      ) : filtered.length === 0 ? (
        <DiscoverEmptyState
          className="mt-4"
          liveAuctionsOnly={liveAuctionsOnly}
          datePreset={datePreset}
          radiusKm={radiusKm}
          upcomingInAreaCount={upcomingInAreaCount}
          onTryPreset={setDatePreset}
          onWidenRadius={widenRadius}
          onShowEverywhere={() => setRadiusKm(null)}
          onClearLiveAuctionFilter={() => replaceParams({ live: null })}
          marketAlertsHref={marketAlertsHref}
        />
      ) : (
        <DiscoverEventCards
          events={filtered}
          selectedDate={filterDate}
          favoriteIds={favoriteIds}
          activeAuctionByEventId={activeAuctionByEventId}
        />
      )}
      </div>
    </>
  )
}
