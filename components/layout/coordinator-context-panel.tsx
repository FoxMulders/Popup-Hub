'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ArrowRight, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import {
  coordinatorEventIdFromPath,
  coordinatorNavBackHref,
} from '@/lib/coordinator/coordinator-event-route'

export function CoordinatorContextPanel() {
  const pathname = usePathname() ?? ''
  const onCommandCenter = pathname === '/coordinator/dashboard'
  const eventIdFromRoute = coordinatorEventIdFromPath(pathname)

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      aria-label="Coordinator context and telemetry"
    >
      {eventIdFromRoute && !onCommandCenter ? (
        <CommandCenterExitLink eventId={eventIdFromRoute} compact className="w-full" />
      ) : null}

      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/80 bg-card/90 p-3">
        <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-sky-500" aria-hidden />
          Telemetry desk
        </p>
        {onCommandCenter ? (
          <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
            Live booth revenue and Square sync appear in this column on the
            command center.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
              Booth assignments, payment status, and fill-rate metrics update in
              real time from the command center canvas.
            </p>
            <Link
              href={
                eventIdFromRoute
                  ? `/coordinator/dashboard?event=${eventIdFromRoute}`
                  : coordinatorNavBackHref(pathname)
              }
              className="mt-3 block"
            >
              <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                {eventIdFromRoute ? 'Command center telemetry' : 'View live telemetry'}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/60 bg-canvas/80 p-3 text-[0.6875rem] text-muted-foreground">
        <p className="font-semibold text-foreground">Square sync</p>
        <p className="mt-1 leading-snug">
          Connect Square to reflect paid booths on the floor plan (green) and
          pending balances in telemetry.
        </p>
        <Link
          href="/coordinator/payment-methods"
          className="mt-2 inline-flex text-sky-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        >
          Manage connection
        </Link>
      </div>
    </aside>
  )
}
