'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarDays, ChevronRight, LayoutDashboard, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DashboardEventSummary } from './market-management-context'

interface CoordinatorMobileOverviewProps {
  events: DashboardEventSummary[]
  totalRevenueCents: number
  squareConnected: boolean
  stripeConnected: boolean
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Lightweight coordinator home for phones — event list and quick links
 * without mounting the floor-plan canvas.
 */
export function CoordinatorMobileOverview({
  events,
  totalRevenueCents,
  squareConnected,
  stripeConnected,
}: CoordinatorMobileOverviewProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Coordinator overview
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">
          Your markets
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a tablet or desktop for the full booth layout designer. On this device you can
          review events, applications, and day-of operations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Lifetime payout</p>
          <p className="mt-1 font-semibold tabular-nums">{formatRevenue(totalRevenueCents)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="mt-1 font-medium">
            {squareConnected || stripeConnected ? 'Connected' : 'Setup needed'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'gap-1.5')}>
          <Plus className="h-4 w-4" aria-hidden />
          New market
        </Link>
        <Link
          href="/coordinator/payment-methods"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
        >
          Payment settings
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/coordinator/events/${event.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-forest/30 hover:bg-canvas"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 font-medium text-foreground">{event.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {events.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
          Open an event, then use Operations or Check-In — layout editing needs a larger screen.
        </p>
      ) : null}
    </div>
  )
}
