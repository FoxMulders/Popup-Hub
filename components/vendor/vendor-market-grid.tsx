'use client'

import { useMemo, useState } from 'react'
import { EventCard } from '@/components/events/event-card'
import { ApplyButton } from '@/components/events/apply-button'
import { MarketAreaFilter } from '@/components/markets/market-area-filter'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMarketAreaFilter } from '@/hooks/use-market-area-filter'
import { formatEventCapacitySummary, type EventCapacitySummary } from '@/lib/queries/event-capacity'
import {
  getEventDisplayStatus,
  isEventOpenForApplications,
  type EventDisplayStatus,
} from '@/lib/queries/events'
import { formatDistance } from '@/lib/shopper/geo'
import {
  filterEventsByRadius,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import type { ApplicationStatus, Event } from '@/types/database'
import { Search } from 'lucide-react'

interface VendorMarketGridProps {
  activeEvents: Event[]
  archivedEvents: Event[]
  userId: string
  applicationStatuses: Record<string, ApplicationStatus>
  capacityByEventId: Record<string, EventCapacitySummary>
}

function filterEvents(events: Event[], query: string): Event[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return events

  return events.filter((event) => {
    const coordinator = Array.isArray(event.coordinator)
      ? event.coordinator[0]
      : event.coordinator

    return (
      event.name.toLowerCase().includes(normalized) ||
      event.location_name.toLowerCase().includes(normalized) ||
      (coordinator?.full_name?.toLowerCase().includes(normalized) ?? false)
    )
  })
}

function MarketGrid({
  events,
  userId,
  applicationStatuses,
  capacityByEventId,
  emptyMessage,
  showDistance,
}: {
  events: EventWithMeta[]
  userId: string
  applicationStatuses: Record<string, ApplicationStatus>
  capacityByEventId: Record<string, EventCapacitySummary>
  emptyMessage: string
  showDistance: boolean
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => {
        const displayStatus: EventDisplayStatus = getEventDisplayStatus(event, undefined, {
          isFullyBooked: capacityByEventId[event.id]?.isFullyBooked ?? false,
        })
        const applicationsOpen = isEventOpenForApplications(event)

        const capacityLabel = formatEventCapacitySummary(capacityByEventId[event.id])

        return (
          <EventCard
            key={event.id}
            event={event}
            href={`/vendor/events/${event.id}`}
            showBookingMode
            displayStatus={displayStatus}
            capacityLabel={capacityLabel}
            distanceLabel={
              showDistance && event.distance_km != null
                ? formatDistance(event.distance_km)
                : undefined
            }
            actions={
              <ApplyButton
                event={event}
                userId={userId}
                applicationStatus={applicationStatuses[event.id] ?? null}
                applicationsOpen={applicationsOpen}
              />
            }
          />
        )
      })}
    </div>
  )
}

export function VendorMarketGrid({
  activeEvents,
  archivedEvents,
  userId,
  applicationStatuses,
  capacityByEventId,
}: VendorMarketGridProps) {
  const [search, setSearch] = useState('')
  const {
    origin,
    radiusKm,
    setRadiusKm,
    locationLabel,
    locating,
    useMyLocation,
  } = useMarketAreaFilter()

  const withDistance = useMemo(() => {
    const toMeta = (list: Event[]): EventWithMeta[] =>
      list.map((e) => ({ ...e, vendor_count: 0 }))
    const activeMeta = sortEventsByDistance(toMeta(activeEvents), origin)
    const archivedMeta = sortEventsByDistance(toMeta(archivedEvents), origin)
    return {
      active: filterEventsByRadius(activeMeta, radiusKm),
      archived: filterEventsByRadius(archivedMeta, radiusKm),
    }
  }, [activeEvents, archivedEvents, origin, radiusKm])

  const filteredActive = useMemo(
    () => filterEvents(withDistance.active, search),
    [withDistance.active, search]
  )
  const filteredArchived = useMemo(
    () => filterEvents(withDistance.archived, search),
    [withDistance.archived, search]
  )

  return (
    <div className="space-y-4">
      <MarketAreaFilter
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        locationLabel={locationLabel}
        locating={locating}
        onUseMyLocation={useMyLocation}
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search markets by name, location, or organizer…"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Open markets ({activeEvents.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Past events ({archivedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <MarketGrid
            events={filteredActive}
            userId={userId}
            applicationStatuses={applicationStatuses}
            capacityByEventId={capacityByEventId}
            emptyMessage={
              search
                ? 'No open markets match your search.'
                : 'No active open markets within this distance.'
            }
            showDistance
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <MarketGrid
            events={filteredArchived}
            userId={userId}
            applicationStatuses={applicationStatuses}
            capacityByEventId={capacityByEventId}
            emptyMessage={
              search
                ? 'No past events match your search.'
                : 'No past events within this distance.'
            }
            showDistance
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
