'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import {
  FACING_TARGET_OPTIONS,
  type FacingTarget,
  facingTargetLabel,
  invertFacingTarget,
} from '@/lib/booth-planner/facing-target'

const PERIMETER_TARGETS: FacingTarget[] = [
  'north',
  'south',
  'east',
  'west',
  'nw',
  'ne',
  'sw',
  'se',
]

export interface CanvasPerimeterFacingControlsProps {
  /** Hall interior origin within the canvas wrapper (px). */
  hallLeft: number
  hallTop: number
  hallWidth: number
  hallHeight: number
  value: FacingTarget
  onFacingClick: (target: FacingTarget) => void
  suggestedTarget?: FacingTarget | null
  autoMode?: boolean
  selectionLabel?: string | null
  /** Gap between hall edge and control (px, pre-scale). */
  margin?: number
}

const optionById = new Map(FACING_TARGET_OPTIONS.map((o) => [o.id, o]))

function positionForTarget(
  target: FacingTarget,
  hallLeft: number,
  hallTop: number,
  hallWidth: number,
  hallHeight: number,
  margin: number
): CSSProperties {
  const cx = hallLeft + hallWidth / 2
  const cy = hallTop + hallHeight / 2
  const corner = margin + 2

  switch (target) {
    case 'north':
      return { left: cx, top: hallTop - margin, transform: 'translate(-50%, -100%)' }
    case 'south':
      return { left: cx, top: hallTop + hallHeight + margin, transform: 'translate(-50%, 0)' }
    case 'west':
      return { left: hallLeft - margin, top: cy, transform: 'translate(-100%, -50%)' }
    case 'east':
      return { left: hallLeft + hallWidth + margin, top: cy, transform: 'translate(0, -50%)' }
    case 'nw':
      return { left: hallLeft - corner, top: hallTop - corner, transform: 'translate(-100%, -100%)' }
    case 'ne':
      return { left: hallLeft + hallWidth + corner, top: hallTop - corner, transform: 'translate(0, -100%)' }
    case 'sw':
      return { left: hallLeft - corner, top: hallTop + hallHeight + corner, transform: 'translate(-100%, 0)' }
    case 'se':
      return { left: hallLeft + hallWidth + corner, top: hallTop + hallHeight + corner, transform: 'translate(0, 0)' }
  }
}

/**
 * Direction pads anchored to the hall perimeter — no enclosing box; controls pan/zoom with the grid.
 */
export function CanvasPerimeterFacingControls({
  hallLeft,
  hallTop,
  hallWidth,
  hallHeight,
  value,
  onFacingClick,
  suggestedTarget,
  autoMode = false,
  selectionLabel,
  margin = 10,
}: CanvasPerimeterFacingControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-label="Storefront facing controls">
      {selectionLabel ? (
        <div
          className="pointer-events-none absolute z-40 max-w-[140px] truncate rounded border border-stone-300/90 bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-forest shadow-sm"
          style={{
            left: hallLeft + hallWidth / 2,
            top: hallTop - margin - 22,
            transform: 'translate(-50%, -100%)',
          }}
          title={selectionLabel}
        >
          {selectionLabel}
        </div>
      ) : null}
      {PERIMETER_TARGETS.map((target) => {
        const opt = optionById.get(target)!
        const applied = invertFacingTarget(target)
        const selected = !autoMode && value === applied
        const suggested = autoMode && suggestedTarget === applied
        return (
          <TooltipWrapper key={target} text={`Face ${facingTargetLabel(target)} (180° auto-flip)`}>
            <button
              type="button"
              aria-label={`Face ${facingTargetLabel(target)}`}
              aria-pressed={selected || suggested}
              onClick={() => onFacingClick(target)}
              style={positionForTarget(target, hallLeft, hallTop, hallWidth, hallHeight, margin)}
              className={cn(
                'pointer-events-auto absolute z-40 flex h-7 min-w-7 items-center justify-center rounded border px-1 text-[10px] font-black uppercase tracking-tight shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors',
                selected || suggested
                  ? 'border-forest bg-forest text-primary-foreground'
                  : 'border-black bg-white text-black hover:bg-canvas'
              )}
            >
              {opt.short}
            </button>
          </TooltipWrapper>
        )
      })}
    </div>
  )
}
