'use client'

import { useMemo, useState } from 'react'
import { EventCard } from '@/components/events/event-card'
import { ApplyButton } from '@/components/events/apply-button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EventCapacitySummary } from '@/lib/queries/event-capacity'
import {
  getEventDisplayStatus,
  isEventOpenForApplications,
  type EventDisplayStatus,
} from '@/lib/queries/events'
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
}: {
  events: Event[]
  userId: string
  applicationStatuses: Record<string, ApplicationStatus>
  capacityByEventId: Record<string, EventCapacitySummary>
  emptyMessage: string
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
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

        return (
          <EventCard
            key={event.id}
            event={event}
            href={`/vendor/events/${event.id}`}
            showBookingMode
            displayStatus={displayStatus}
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

  const filteredActive = useMemo(
    () => filterEvents(activeEvents, search),
    [activeEvents, search]
  )
  const filteredArchived = useMemo(
    () => filterEvents(archivedEvents, search),
    [archivedEvents, search]
  )

  return (
    <div className="space-y-4">
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
                : 'No active open markets available right now.'
            }
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
                : 'No past events in your history yet.'
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
