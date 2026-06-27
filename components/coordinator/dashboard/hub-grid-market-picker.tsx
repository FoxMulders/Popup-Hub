'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, LayoutDashboard, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import type { DashboardEventSummary } from './market-management-context'

function statusLabel(status: string): string {
  if (status === 'draft') return 'Draft'
  if (status === 'published') return 'Published'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

interface HubGridMarketPickerProps {
  events: DashboardEventSummary[]
  onSelect: (eventId: string) => void
  className?: string
}

/** Full-screen gate — coordinator must pick a market before HubGrid loads. */
export function HubGridMarketPicker({ events, onSelect, className }: HubGridMarketPickerProps) {
  return (
    <div
      className={cn(
        'flex min-h-[min(70vh,640px)] flex-col items-center justify-center px-4 py-10',
        className
      )}
    >
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-forest/10 text-forest">
          <LayoutDashboard className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
            Select a market
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which market you want to design in HubGrid. Booth layout, ledger, and payments
            all scope to the market you pick here.
          </p>
        </div>

        <ul className="space-y-2 text-left" role="list">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                className="marketing-glass-card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-forest/30 hover:shadow-[var(--shadow-market-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium text-foreground">{event.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{safeFormatMarketDate(event.start_at)}</span>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                      {statusLabel(event.status)}
                    </Badge>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'gap-1.5')}>
            <Plus className="h-4 w-4" aria-hidden />
            Create New Market
          </Link>
        </div>
      </div>
    </div>
  )
}

interface HubGridMarketSelectProps {
  events: DashboardEventSummary[]
  selectedEventId: string | null
  onSelect: (eventId: string) => void
  className?: string
}

/** Compact header control for switching markets while in HubGrid. */
export function HubGridMarketSelect({
  events,
  selectedEventId,
  onSelect,
  className,
}: HubGridMarketSelectProps) {
  return (
    <label className={cn('flex min-w-0 max-w-[min(100%,14rem)] flex-col gap-0.5', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Market
      </span>
      <select
        value={selectedEventId ?? ''}
        onChange={(event) => {
          const next = event.target.value
          if (next) onSelect(next)
        }}
        className="h-8 w-full truncate rounded-md border border-stone-300 bg-white px-2 text-xs font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
        aria-label="Active market"
      >
        <option value="" disabled>
          Select market…
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
    </label>
  )
}
