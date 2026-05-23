'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getEventDisplayStatus } from '@/lib/queries/events'
import type { Event } from '@/types/database'
import { Calendar, Search } from 'lucide-react'

interface CoordinatorEventFeedProps {
  activeEvents: Event[]
  archivedEvents: Event[]
}

function filterEvents(events: Event[], query: string): Event[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return events

  return events.filter(
    (event) =>
      event.name.toLowerCase().includes(normalized) ||
      event.location_name.toLowerCase().includes(normalized)
  )
}

function EventSection({
  events,
  emptyMessage,
}: {
  events: Event[]
  emptyMessage: React.ReactNode
}) {
  if (events.length === 0) {
    return (
      <div className="market-panel py-16 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          href={`/coordinator/events/${event.id}`}
          displayStatus={getEventDisplayStatus(event)}
        />
      ))}
    </div>
  )
}

export function CoordinatorEventFeed({
  activeEvents,
  archivedEvents,
}: CoordinatorEventFeedProps) {
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
          placeholder="Search your markets…"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active markets ({activeEvents.length})</TabsTrigger>
          <TabsTrigger value="archived">Past events ({archivedEvents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <EventSection
            events={filteredActive}
            emptyMessage={
              search ? (
                <p className="text-muted-foreground text-sm">No active markets match your search.</p>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">No active markets right now.</p>
                  <Link href="/coordinator/events/new">
                    <Button size="sm" className="mt-4">
                      Create First Event
                    </Button>
                  </Link>
                </>
              )
            }
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <EventSection
            events={filteredArchived}
            emptyMessage={
              <p className="text-muted-foreground text-sm">
                {search ? 'No past events match your search.' : 'No archived markets yet.'}
              </p>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
