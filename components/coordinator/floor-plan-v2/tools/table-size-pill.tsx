'use client'

import { cn } from '@/lib/utils'
import {
  LAYOUT_BASELINE_TABLE_LENGTHS_FT,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'

interface TableSizePillProps {
  value: LayoutBaselineTableLengthFt
  onChange: (ft: LayoutBaselineTableLengthFt) => void
  disabled?: boolean
  className?: string
}

/**
 * Compact baseline-table-length pill, designed to live inside the
 * floor-plan canvas command ribbon. The full-fat selector still lives
 * at `components/coordinator/table-size-selector.tsx` for non-canvas
 * surfaces (legacy booth planner). This pill matches the ribbon's
 * 32 px row height and tucks the label, button group, and active
 * value into a single tabular-numeric pill.
 */
export function TableSizePill({
  value,
  onChange,
  disabled = false,
  className,
}: TableSizePillProps) {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-stretch overflow-hidden rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700',
        disabled && 'opacity-60',
        className
      )}
      role="group"
      aria-label="Baseline table length"
    >
      <span
        className="hidden items-center px-2 text-[10px] font-heading uppercase tracking-wide text-stone-500 sm:inline-flex"
        aria-hidden
      >
        Table size
      </span>
      <div className="flex h-full sm:border-l sm:border-stone-200">
        {LAYOUT_BASELINE_TABLE_LENGTHS_FT.map((ft) => {
          const active = value === ft
          return (
            <button
              key={ft}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ft)}
              aria-pressed={active}
              title={`Set baseline table length to ${ft} ft`}
              className={cn(
                'inline-flex h-full min-w-[2.1rem] items-center justify-center px-2 text-[11px] font-semibold tabular-nums border-r border-stone-200 last:border-r-0 transition-colors',
                active
                  ? 'bg-[#2D5A27] text-[#F5F2EB]'
                  : 'text-stone-700 hover:bg-stone-100',
                disabled && 'pointer-events-none'
              )}
            >
              {ft}′
            </button>
          )
        })}
      </div>
    </div>
  )
}
