'use client'

import { cn } from '@/lib/utils'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import {
  FACING_TARGET_OPTIONS,
  type FacingTarget,
  facingTargetLabel,
} from '@/lib/booth-planner/facing-target'

const GRID_ORDER: (FacingTarget | null)[] = [
  'nw',
  'north',
  'ne',
  'west',
  null,
  'east',
  'sw',
  'south',
  'se',
]

interface FacingTargetPickerProps {
  value: FacingTarget
  onChange: (target: FacingTarget) => void
  autoMode?: boolean
  onAutoModeChange?: (auto: boolean) => void
  suggestedTarget?: FacingTarget | null
  compact?: boolean
  /** Dock on canvas perimeter — cream card, stone borders. */
  floating?: boolean
  /** Label for active placed booth when re-orienting selection. */
  selectionLabel?: string | null
}

export function FacingTargetPicker({
  value,
  onChange,
  autoMode = false,
  onAutoModeChange,
  suggestedTarget,
  compact = false,
  floating = false,
  selectionLabel,
}: FacingTargetPickerProps) {
  const optionById = new Map(FACING_TARGET_OPTIONS.map((o) => [o.id, o]))

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        compact ? 'min-w-0' : 'min-w-[168px]',
        floating && 'market-panel pointer-events-auto p-2.5 shadow-[var(--shadow-market-md)] max-w-[188px]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <label
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            floating ? 'text-muted-foreground font-heading' : 'text-black'
          )}
        >
          Storefront facing
        </label>
        {onAutoModeChange ? (
          <TooltipWrapper text="Auto snaps facing toward nearest wall or corner while hovering the grid">
            <button
              type="button"
              onClick={() => onAutoModeChange(!autoMode)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border',
                autoMode
                  ? 'bg-forest text-primary-foreground border-forest'
                  : floating
                    ? 'bg-card text-foreground border-stone-200'
                    : 'bg-card text-black border-black'
              )}
            >
              Auto
            </button>
          </TooltipWrapper>
        ) : null}
      </div>
      {selectionLabel ? (
        <p className="text-[10px] font-medium text-forest leading-snug truncate" title={selectionLabel}>
          Selected: {selectionLabel}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-0.5">
        {GRID_ORDER.map((id, i) => {
          if (id == null) {
            return (
              <div
                key={`center-${i}`}
                className="flex items-center justify-center text-[9px] font-bold text-muted-foreground"
                aria-hidden
              >
                ·
              </div>
            )
          }
          const opt = optionById.get(id)!
          const selected = !autoMode && value === id
          const suggested = autoMode && suggestedTarget === id
          return (
            <TooltipWrapper key={id} text={facingTargetLabel(id)}>
              <button
                type="button"
                aria-label={facingTargetLabel(id)}
                aria-pressed={selected || suggested}
                onClick={() => {
                  onAutoModeChange?.(false)
                  onChange(id)
                }}
                className={cn(
                  'rounded border text-[10px] font-bold min-h-7 transition-colors',
                  selected || suggested
                    ? 'bg-forest text-primary-foreground border-forest'
                    : floating
                      ? 'bg-card text-foreground border-stone-200 hover:bg-canvas'
                      : 'bg-card text-black border-black hover:bg-muted'
                )}
              >
                {opt.short}
              </button>
            </TooltipWrapper>
          )
        })}
      </div>
      {!compact ? (
        <p className="text-[10px] font-semibold text-black leading-snug">
          {autoMode
            ? suggestedTarget
              ? `Auto: ${facingTargetLabel(suggestedTarget)}`
              : 'Auto: hover grid to snap toward nearest wall'
            : facingTargetLabel(value)}
        </p>
      ) : null}
    </div>
  )

}
