'use client'

import { Calendar, MapPin, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_SECTION_LABEL } from '@/lib/wizard/wizard-panel-styles'
import type { SummaryVenueSelection } from '@/components/coordinator/wizard/wizard-summary-rail'

export function WizardScheduleLines({
  lines,
  className,
}: {
  lines: string[]
  className?: string
}) {
  if (lines.length === 0) return null

  return (
    <ul className={cn('space-y-0.5', className)} aria-label="Market hours">
      {lines.map((line) => (
        <li key={line} className="text-xs sm:text-sm text-foreground/90 tabular-nums leading-snug">
          {line}
        </li>
      ))}
    </ul>
  )
}

interface WizardContextStripProps {
  eventName?: string | null
  scheduleLines?: string[]
  selectedVenue?: SummaryVenueSelection | null
  capacityLabel?: string | null
  tableSizeLabel?: string | null
  stepLabel: string
}

export function WizardContextStrip({
  eventName,
  scheduleLines = [],
  selectedVenue,
  capacityLabel,
  tableSizeLabel,
  stepLabel,
}: WizardContextStripProps) {
  const hasSchedule = scheduleLines.length > 0
  const hasVenue = Boolean(selectedVenue)
  const hasCapacity = Boolean(capacityLabel?.trim())

  if (!eventName?.trim() && !hasSchedule && !hasVenue && !hasCapacity) return null

  return (
    <div
      className="market-panel w-full px-3 py-3 sm:px-4 sm:py-3.5"
      aria-label="Market context"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={WIZARD_SECTION_LABEL}>{stepLabel}</span>
            {eventName?.trim() ? (
              <p className="font-heading text-base sm:text-lg font-semibold text-foreground truncate max-w-full">
                {eventName.trim()}
              </p>
            ) : null}
          </div>
          {hasSchedule ? (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-harvest-600" aria-hidden />
              <WizardScheduleLines lines={scheduleLines} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-stretch gap-2 shrink-0">
          {hasVenue && selectedVenue ? (
            <div className="rounded-lg border border-sage-200 bg-sage-50/80 px-3 py-2 min-w-[140px] max-w-[220px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                Venue
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground leading-snug break-words">
                {selectedVenue.name}
              </p>
              {!selectedVenue.locationOnly &&
              selectedVenue.width != null &&
              selectedVenue.length != null ? (
                <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {selectedVenue.width} × {selectedVenue.length} ft
                </p>
              ) : null}
            </div>
          ) : null}

          {hasCapacity ? (
            <div className="rounded-lg border border-harvest-200 bg-harvest-50/80 px-3 py-2 min-w-[100px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Settings2 className="h-3 w-3" aria-hidden />
                Caps
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{capacityLabel}</p>
              {tableSizeLabel ? (
                <p className="text-[10px] text-muted-foreground mt-0.5">{tableSizeLabel}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
