'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { WizardScheduleLines } from '@/components/coordinator/wizard/wizard-context-strip'
import {
  WIZARD_PANEL,
  WIZARD_SECTION_LABEL,
  WIZARD_SUMMARY_META_LABEL,
  WIZARD_SUMMARY_VALUE,
  WIZARD_SUMMARY_VALUE_EMPHASIS,
  WIZARD_SUMMARY_VALUE_SAGE,
  WIZARD_SUMMARY_VALUE_WARN,
} from '@/lib/wizard/wizard-panel-styles'

export interface SummaryVenueSelection {
  name: string
  width?: number
  length?: number
  address?: string
  locationOnly?: boolean
}

export interface WizardSummaryRailProps {
  eventName?: string | null
  scheduleLines?: string[]
  selectedVenue?: SummaryVenueSelection | null
  capacityLabel?: string | null
  tableSizeLabel?: string | null
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  className?: string
  /** Primary step action (e.g. Proceed to vendor spots) rendered under selections. */
  footerAction?: React.ReactNode
}

export function WizardSummaryRail({
  eventName,
  scheduleLines = [],
  selectedVenue,
  capacityLabel,
  tableSizeLabel,
  autosaveStatus,
  className,
  footerAction,
}: WizardSummaryRailProps) {
  const showEvent = Boolean(eventName?.trim())
  const showSchedule = scheduleLines.length > 0
  const showVenue = Boolean(selectedVenue)
  const showCapacity = Boolean(capacityLabel?.trim())

  return (
    <aside
      className={cn(
        WIZARD_PANEL,
        // Wizard layout now stacks vertically so the rail spans the full
        // timeline width — drop the lg:w-72 sidebar constraint to align.
        'h-fit p-4 space-y-4 w-full',
        className
      )}
      aria-label="Wizard selection summary"
    >
      <h2 className={cn(WIZARD_SECTION_LABEL, 'border-b border-stone-200/80 pb-2')}>
        Your Selections
      </h2>
      <ul className="space-y-3 text-sm">
        {showEvent ? (
          <li className="space-y-1">
            <span className={WIZARD_SUMMARY_META_LABEL}>Event</span>
            <p className={WIZARD_SUMMARY_VALUE_EMPHASIS}>{eventName!.trim()}</p>
          </li>
        ) : null}

        {showSchedule ? (
          <li className="space-y-1">
            <span className={WIZARD_SUMMARY_META_LABEL}>Hours</span>
            <div className={cn(WIZARD_SUMMARY_VALUE, 'px-2 py-2')}>
              <WizardScheduleLines lines={scheduleLines} />
            </div>
          </li>
        ) : null}

        {showVenue && selectedVenue ? (
          <li className="space-y-1">
            <span className={WIZARD_SUMMARY_META_LABEL}>Venue</span>
            <div className={WIZARD_SUMMARY_VALUE_SAGE}>
              <p className="font-medium whitespace-normal break-words">{selectedVenue.name}</p>
              {selectedVenue.address ? (
                <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">
                  {selectedVenue.address}
                </p>
              ) : null}
              {!selectedVenue.locationOnly &&
              selectedVenue.width != null &&
              selectedVenue.length != null ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedVenue.width} × {selectedVenue.length} ft
                </p>
              ) : null}
            </div>
          </li>
        ) : null}

        {showCapacity ? (
          <li className="space-y-1">
            <span className={WIZARD_SUMMARY_META_LABEL}>Capacity</span>
            <p
              className={WIZARD_SUMMARY_VALUE_WARN}
              title="Calculated value accounts for standard 10ft walking aisles and emergency fire paths."
            >
              Max Booths: {capacityLabel}
              {tableSizeLabel ? (
                <span className="block text-xs mt-0.5 text-muted-foreground">{tableSizeLabel}</span>
              ) : null}
              <span className="block text-[10px] mt-0.5 text-muted-foreground">
                Reserves 10ft walking aisles &amp; fire paths.
              </span>
            </p>
          </li>
        ) : null}
      </ul>
      {!showEvent && !showSchedule && !showVenue && !showCapacity ? (
        <p className="text-xs text-muted-foreground whitespace-normal break-words">
          Selections appear here as you complete each wizard step.
        </p>
      ) : null}
      {footerAction ? (
        <div className="border-t border-stone-200/80 pt-3">{footerAction}</div>
      ) : null}
      <p className="text-[10px] text-muted-foreground border-t border-stone-200/80 pt-2">
        {autosaveStatus === 'saving' && 'Saving…'}
        {autosaveStatus === 'saved' && 'All changes saved'}
        {autosaveStatus === 'error' && 'Save failed — retry on next step'}
        {autosaveStatus === 'idle' && 'Ready'}
      </p>
    </aside>
  )
}
