'use client'

import { LayoutGrid, MapPin } from 'lucide-react'
import { FloorPlanV2, type FloorPlanV2Props } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import { WizardContextStrip } from '@/components/coordinator/wizard/wizard-context-strip'
import { WizardNav } from '@/components/coordinator/wizard/wizard-nav'
import { WizardZone } from '@/components/coordinator/wizard/wizard-ui'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'
import type { SummaryVenueSelection } from '@/components/coordinator/wizard/wizard-summary-rail'
import { cn } from '@/lib/utils'

export interface WizardStepFloorPlanProps extends FloorPlanV2Props {
  scheduleLines: string[]
  selectedVenue: SummaryVenueSelection | null
  capacityLabel: string | null
  tableSizeLabel: string | null
  layoutCapacity: number
  totalCategoryCaps: number
  eventDisplayName: string
  onBack: () => void
  navDisabled?: boolean
  plannerOverlap?: boolean
}

export function WizardStepFloorPlan({
  scheduleLines,
  selectedVenue,
  capacityLabel,
  tableSizeLabel,
  layoutCapacity,
  totalCategoryCaps,
  eventDisplayName,
  onBack,
  navDisabled = false,
  plannerOverlap = false,
  ...floorPlanProps
}: WizardStepFloorPlanProps) {
  return (
    <div className="wizard-step3-deck flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5 shrink-0">
        <div className="min-w-0">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Step 3
          </p>
          <h2 className="font-heading text-[clamp(1.25rem,1.2vw+1rem,1.75rem)] font-bold tracking-tight text-forest">
            Design your floor plan
          </h2>
          {eventDisplayName ? (
            <p className="mt-0.5 truncate text-sm font-medium text-foreground/90 max-w-[40ch]">
              {eventDisplayName}
            </p>
          ) : null}
        </div>
        <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">
          Draft
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
        {selectedVenue?.width != null && selectedVenue.length != null ? (
          <span className="wizard-glass-inset inline-flex items-center gap-1 rounded-md px-2.5 py-1 tabular-nums">
            <MapPin className="h-3 w-3 text-forest" aria-hidden />
            {selectedVenue.width}×{selectedVenue.length} ft
          </span>
        ) : null}
        <span
          className="wizard-glass-inset rounded-md border-sage-200/80 px-2.5 py-1 tabular-nums"
          title="Structural booth ceiling from Step 2"
        >
          C<sub>max</sub> <strong className="text-foreground">{layoutCapacity}</strong>
        </span>
        <span className="wizard-glass-inset rounded-md border-harvest-200/80 px-2.5 py-1 tabular-nums">
          Caps <strong className="text-foreground">{totalCategoryCaps || '—'}</strong>
        </span>
        {tableSizeLabel ? (
          <span className="wizard-glass-inset rounded-md px-2.5 py-1">{tableSizeLabel}</span>
        ) : null}
        {plannerOverlap ? (
          <span className="rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-1 font-medium text-amber-950">
            Overlaps detected
          </span>
        ) : null}
      </div>

      <WizardContextStrip
        stepLabel="Step 3 — Floor plan"
        eventName={eventDisplayName || null}
        scheduleLines={scheduleLines}
        selectedVenue={selectedVenue}
        capacityLabel={capacityLabel}
        tableSizeLabel={tableSizeLabel}
      />

      <WizardZone
        id="wizard-zone-floor-canvas"
        title="CAD workspace"
        subtitle="Pan and zoom the canvas, place booths and fixtures, then save & deploy when QA is clear."
        variant="canvas"
        className="min-h-[min(72vh,720px)]"
      >
        <p className="wizard-glass-inset flex shrink-0 items-start gap-2 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          <LayoutGrid className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
          <span>
            Use the command bar for tools, auto-arrange, and room zones. Press{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 font-mono text-[10px]">
              ]
            </kbd>{' '}
            to toggle the inspector. Save &amp; deploy publishes the market when nothing overlaps.
          </span>
        </p>
        <div
          className={cn(
            'wizard-floor-canvas-host relative min-h-0 flex-1 overflow-hidden rounded-xl',
            'border border-stone-200/90 bg-stone-100/80 shadow-[inset_0_1px_2px_rgb(62_45_28/0.06)]'
          )}
        >
          <FloorPlanV2 {...floorPlanProps} className="absolute inset-0 min-h-0" />
        </div>
      </WizardZone>

      <div className="shrink-0">
        <WizardNav step={3} onBack={onBack} nextDisabled={navDisabled} />
      </div>
    </div>
  )
}
