'use client'

import { cn } from '@/lib/utils'
import { TABLE_SIZES } from '@/lib/booth-planner/layout-table-size'
import {
  GUEST_TABLE_LENGTHS_FT,
  guestRectTableSpec,
  guestRoundTableSpec,
  tableSizeSpecsEqual,
  vendorTableSpec,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'

interface TableSizePillProps {
  value: TableSizeSpec
  onChange: (selection: TableSizeSpec) => void
  disabled?: boolean
  className?: string
}

function sizeButtonClass(active: boolean, disabled: boolean): string {
  return cn(
    'inline-flex h-full min-w-[1.85rem] shrink-0 items-center justify-center px-1.5 text-[10px] font-semibold tabular-nums border-r border-stone-200 last:border-r-0 transition-colors sm:min-w-[2rem] sm:px-2 sm:text-[11px]',
    active ? 'bg-sky-600 text-white' : 'text-stone-700 hover:bg-stone-100',
    disabled && 'pointer-events-none'
  )
}

function sectionLabel(text: string): React.ReactNode {
  return (
    <span
      className="inline-flex h-full items-center border-r border-stone-200 bg-stone-50 px-1 text-[9px] font-heading uppercase tracking-wide text-stone-500"
      aria-hidden
    >
      {text}
    </span>
  )
}

/**
 * Compact table-size pill for the floor-plan canvas command ribbon.
 * Vendor booth sizes update the hall baseline; guest round/rect tables
 * are seating-only and do not change venue capacity math.
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
      aria-label="Table size"
    >
      <span
        className="hidden items-center px-2 text-[10px] font-heading uppercase tracking-wide text-stone-500 sm:inline-flex"
        aria-hidden
      >
        Table size
      </span>
      <div className="flex h-full max-w-[min(100%,42rem)] overflow-x-auto sm:border-l sm:border-stone-200">
        {sectionLabel('Booth')}
        {TABLE_SIZES.map((ft) => {
          const selection = vendorTableSpec(ft)
          const active = tableSizeSpecsEqual(value, selection)
          return (
            <button
              key={`booth-${ft}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selection)}
              aria-pressed={active}
              title={`Set vendor booth table length to ${ft} ft`}
              className={sizeButtonClass(active, disabled)}
            >
              {ft}′
            </button>
          )
        })}
        {sectionLabel('Round')}
        {GUEST_TABLE_LENGTHS_FT.map((ft) => {
          const selection = guestRoundTableSpec(ft)
          const active = tableSizeSpecsEqual(value, selection)
          return (
            <button
              key={`round-${ft}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selection)}
              aria-pressed={active}
              title={`Set guest round table diameter to ${ft} ft`}
              className={sizeButtonClass(active, disabled)}
            >
              {ft}′
            </button>
          )
        })}
        {sectionLabel('Rect')}
        {GUEST_TABLE_LENGTHS_FT.map((ft) => {
          const selection = guestRectTableSpec(ft)
          const active = tableSizeSpecsEqual(value, selection)
          return (
            <button
              key={`guest-rect-${ft}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selection)}
              aria-pressed={active}
              title={`Set guest rectangular table length to ${ft} ft`}
              className={sizeButtonClass(active, disabled)}
            >
              {ft}′
            </button>
          )
        })}
      </div>
    </div>
  )
}
