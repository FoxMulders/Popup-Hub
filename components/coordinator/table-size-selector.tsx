'use client'

import { cn } from '@/lib/utils'
import {
  LAYOUT_BASELINE_TABLE_LENGTHS_FT,
  type LayoutBaselineTableLengthFt,
  layoutBaselineGridSpans,
} from '@/lib/booth-planner/layout-table-size'

interface TableSizeSelectorProps {
  value: LayoutBaselineTableLengthFt
  onChange: (ft: LayoutBaselineTableLengthFt) => void
  disabled?: boolean
  className?: string
}

export function TableSizeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: TableSizeSelectorProps) {
  return (
    <div
      className={cn(
        'market-panel shrink-0 p-3 space-y-2 min-w-[220px]',
        className
      )}
    >
      <p className="font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Table Size
      </p>
      <div
        className="flex rounded-xl border-2 border-stone-200 overflow-hidden bg-card"
        role="group"
        aria-label="Baseline table length"
      >
        {LAYOUT_BASELINE_TABLE_LENGTHS_FT.map((ft) => {
          const { colSpan, rowSpan } = layoutBaselineGridSpans(ft)
          const active = value === ft
          return (
            <button
              key={ft}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ft)}
              aria-pressed={active}
              className={cn(
                'flex-1 min-h-11 px-2 py-2 text-xs font-heading font-semibold transition-all duration-200 border-r border-stone-200 last:border-r-0 active:translate-y-0.5 disabled:opacity-50',
                active
                  ? 'bg-[#2D5A27] text-[#F5F2EB]'
                  : 'bg-stone-100 text-stone-800 hover:bg-stone-50'
              )}
            >
              <span className="block">{ft}′</span>
              <span
                className={cn(
                  'block text-[9px] font-normal mt-0.5 tabular-nums',
                  active ? 'text-[#F5F2EB]/85' : 'text-stone-600'
                )}
              >
                {colSpan}×{rowSpan}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        One size for this hall — applies to every table vendor ({value}′ × 2′ equipment core + 8′ co-aisle).
      </p>
    </div>
  )
}
