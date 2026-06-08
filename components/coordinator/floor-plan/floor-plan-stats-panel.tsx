'use client'

import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import {
  WIZARD_SECTION_LABEL,
  WIZARD_SUMMARY_META_LABEL,
  WIZARD_SUMMARY_VALUE,
  WIZARD_SUMMARY_VALUE_EMPHASIS,
  WIZARD_SUMMARY_VALUE_SAGE,
  WIZARD_SUMMARY_VALUE_WARN,
} from '@/lib/wizard/wizard-panel-styles'
import { cn } from '@/lib/utils'

export interface FloorPlanStatsPanelProps {
  roomName: string
  gridCols: number
  gridRows: number
  placedCount: number
  unplacedCount: number
  maxBoothCapacity: number
  layoutCapacity: number
  /**
   * True when the configured Step 3 slot total had to be clamped down to the
   * physical layout ceiling. Surfaces a small inline note so coordinators
   * understand the displayed cap is not the raw slot total.
   */
  capacityClampedByLayout?: boolean
  baselineTableLengthFt: number
  entrance: string
  lockedFixtureCount: number
  hasOverlap: boolean
  hasStrollerBottleneck: boolean
}

export function FloorPlanStatsPanel({
  roomName,
  gridCols,
  gridRows,
  placedCount,
  unplacedCount,
  maxBoothCapacity,
  layoutCapacity,
  capacityClampedByLayout = false,
  baselineTableLengthFt,
  entrance,
  lockedFixtureCount,
  hasOverlap,
  hasStrollerBottleneck,
}: FloorPlanStatsPanelProps) {
  const atCapacity = unplacedCount > 0 && placedCount > 0

  return (
    <article className="market-panel space-y-2 p-3" aria-label="Room statistics">
      <h3 className={cn(WIZARD_SECTION_LABEL, 'border-b border-stone-200/80 pb-1.5')}>Your Selections</h3>
      <ul className="space-y-2 text-xs">
        <li>
          <span className={WIZARD_SUMMARY_META_LABEL}>Room</span>
          <p className={WIZARD_SUMMARY_VALUE_EMPHASIS}>{roomName}</p>
        </li>
        <li>
          <span className={WIZARD_SUMMARY_META_LABEL}>Inventory</span>
          <p className={cn(WIZARD_SUMMARY_VALUE, 'tabular-nums')}>
            <span className="text-forest font-semibold">{placedCount} placed</span>
            {unplacedCount > 0 ? (
              <>
                {' · '}
                <span className="text-terracotta-700 font-semibold">{unplacedCount} unplaced</span>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
            {gridCols} × {gridRows} ft grid
          </p>
        </li>
        <li>
          <span className={WIZARD_SUMMARY_META_LABEL}>Capacity</span>
          <p className={atCapacity ? WIZARD_SUMMARY_VALUE_WARN : WIZARD_SUMMARY_VALUE}>
            Max booths: {maxBoothCapacity}
            <span className="block text-xs mt-0.5 text-muted-foreground">
              ~{layoutCapacity} max with 8′ aisles · {baselineTableLengthFt}′ baseline table
            </span>
            {capacityClampedByLayout ? (
              <span className="mt-1 block rounded border border-harvest-300 bg-harvest-50 px-1.5 py-1 text-[10px] font-semibold text-harvest-900">
                Clamped to physical layout ceiling — Step 3 slots exceed what fits with required
                aisles.
              </span>
            ) : null}
          </p>
        </li>
        <li>
          <span className={WIZARD_SUMMARY_META_LABEL}>Entrance</span>
          <p className={cn(WIZARD_SUMMARY_VALUE_SAGE, 'capitalize')}>{entrance}</p>
        </li>
      </ul>
      <TooltipWrapper text="Drag doors on outer walls, or use Entrance (E) / Exit (X). Space + drag pans the canvas; Ctrl + scroll zooms.">
        <p className="cursor-default text-[10px] font-medium tabular-nums text-muted-foreground">
          {lockedFixtureCount > 0 ? `${lockedFixtureCount} locked · ` : ''}
          {hasOverlap ? 'overlap · ' : ''}
          {hasStrollerBottleneck ? 'stroller warnings' : 'layout clear'}
        </p>
      </TooltipWrapper>
    </article>
  )
}
