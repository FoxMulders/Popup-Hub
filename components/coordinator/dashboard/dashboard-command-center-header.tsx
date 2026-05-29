'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useMarketManagement } from './market-management-context'

export function DashboardCommandCenterHeader() {
  const { events, selectedEventId } = useMarketManagement()
  const { fullscreen: immersive } = useCommandCenterFullscreen()
  const selectedEvent = events.find((e) => e.id === selectedEventId)

  if (immersive) {
    return selectedEventId ? (
      <CommandCenterExitLink
        eventId={selectedEventId}
        eventName={selectedEvent?.name}
        className="shrink-0"
      />
    ) : (
      <span className="text-sm text-muted-foreground">Booth designer</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        {selectedEventId ? (
          <CommandCenterExitLink
            eventId={selectedEventId}
            eventName={selectedEvent?.name}
            className="shrink-0"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold sm:text-2xl">
            Market command center
          </h1>
          <p className="text-sm text-muted-foreground">
            CAD booth designer · curation queue · payment telemetry
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/coordinator/payment-methods">
          <Button variant="outline" size="sm">
            Payments
          </Button>
        </Link>
        <Link href="/coordinator/events/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            New market
          </Button>
        </Link>
      </div>
    </div>
  )
}
