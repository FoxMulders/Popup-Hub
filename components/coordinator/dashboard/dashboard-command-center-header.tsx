'use client'

import Link from 'next/link'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useMarketManagement } from './market-management-context'
import { cn } from '@/lib/utils'

export function DashboardCommandCenterHeader() {
  const { events, selectedEventId } = useMarketManagement()
  const { fullscreen: immersive, toggleFullscreen } = useCommandCenterFullscreen()
  const selectedEvent = events.find((e) => e.id === selectedEventId)

  if (immersive) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selectedEventId ? (
          <CommandCenterExitLink
            eventId={selectedEventId}
            eventName={selectedEvent?.name}
            className="shrink-0"
          />
        ) : (
          <span className="text-sm font-medium text-foreground">Booth layout designer</span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={toggleFullscreen}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Panels
          </Button>
          <Link
            href="/coordinator/payment-methods"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Payments
          </Link>
        </div>
      </div>
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
          <h1 className="font-heading text-lg font-semibold sm:text-xl">Booth layout designer</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            CAD floor plan · curation queue · Payments for revenue
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={toggleFullscreen}
        >
          Full canvas
        </Button>
        <Link
          href="/coordinator/payment-methods"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Payments
        </Link>
        <Link
          href="/coordinator/events/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New market
        </Link>
      </div>
    </div>
  )
}
