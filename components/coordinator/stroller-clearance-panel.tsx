'use client'

import { AlertTriangle } from 'lucide-react'
import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/stroller-clearance'
import { DismissibleAlertCard } from '@/components/coordinator/dismissible-alert-card'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'

interface StrollerClearancePanelProps {
  hasBottleneck: boolean
  bottleneckCount: number
  dismissed?: boolean
  onDismiss?: () => void
  /** One-line status chip for the planning dock. */
  inline?: boolean
}

export function StrollerClearancePanel({
  hasBottleneck,
  bottleneckCount,
  dismissed = false,
  onDismiss,
  inline = false,
}: StrollerClearancePanelProps) {
  if (inline) {
    if (hasBottleneck && !dismissed) {
      return (
        <TooltipWrapper text={`${bottleneckCount} aisle cell(s) below ${MIN_STROLLER_AISLE_WIDTH_FT}ft — widen walkways`}>
          <span className="inline-flex items-center gap-1 rounded-full border border-harvest-500/60 bg-harvest-50 px-2 py-0.5 text-[10px] font-semibold text-harvest-800">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Stroller bottleneck ({bottleneckCount})
          </span>
        </TooltipWrapper>
      )
    }
    return (
      <TooltipWrapper text={`Walkways meet ${MIN_STROLLER_AISLE_WIDTH_FT}ft minimum for stroller traffic`}>
        <span className="inline-flex items-center rounded-full border border-stone-200 bg-canvas px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Stroller-safe ✓
        </span>
      </TooltipWrapper>
    )
  }

  if (!hasBottleneck) {
    return (
      <article className="w-full shrink-0 market-panel p-3 space-y-2" aria-live="polite">
        <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">
          Stroller-safe aisles
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Walkways meet the {MIN_STROLLER_AISLE_WIDTH_FT}ft minimum for double-stroller traffic.
          Narrow aisles or tight booth gaps will show warnings on the grid.
        </p>
      </article>
    )
  }

  return (
    <DismissibleAlertCard
      alertId="stroller-bottleneck"
      title="Stroller-safe aisles"
      variant="warning"
      dismissed={dismissed}
      onDismiss={() => onDismiss?.()}
      className="w-full shrink-0"
    >
      <div className="flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2 text-xs leading-relaxed pr-2">
          <p>
            <span className="font-semibold">Aisle bottleneck detected.</span> Walkways must be at least{' '}
            {MIN_STROLLER_AISLE_WIDTH_FT}ft wide to prevent stroller traffic congestion.
          </p>
          <p className="text-[10px] opacity-90">
            {bottleneckCount} grid cell{bottleneckCount === 1 ? '' : 's'} highlighted in amber.
            Widen painted aisles or add space between booths.
          </p>
        </div>
      </div>
    </DismissibleAlertCard>
  )
}
