'use client'

import { cn } from '@/lib/utils'
import {
  TABLE_SIZES,
  type LayoutBaselineTableLengthFt,
  layoutBaselineGridSpans,
} from '@/lib/booth-planner/layout-table-size'
import {
  GUEST_TABLE_LENGTHS_FT,
  guestRectTableSpec,
  guestRoundTableSpec,
  tableSizeSpecsEqual,
  vendorTableSpec,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'

export interface TableSizeSelectorProps {
  value: LayoutBaselineTableLengthFt | TableSizeSpec
  onChange: (selection: LayoutBaselineTableLengthFt | TableSizeSpec) => void
  disabled?: boolean
  className?: string
  variant?: 'panel' | 'inline'
  labelTitle?: string
  showGuestOptions?: boolean
}

function resolveValue(
  value: LayoutBaselineTableLengthFt | TableSizeSpec
): TableSizeSpec {
  return typeof value === 'number' ? vendorTableSpec(value) : value
}

export function TableSizeSelector({
  value,
  onChange,
  disabled = false,
  className,
  variant = 'panel',
  labelTitle = 'Venue standard size or vendor-permitted footprint.',
  showGuestOptions = false,
}: TableSizeSelectorProps) {
  const selection = resolveValue(value)

  const buttonClass = (active: boolean) =>
    cn(
      'font-heading font-semibold transition-all duration-200 disabled:opacity-50',
      variant === 'inline'
        ? cn(
            'min-h-9 px-1 py-1.5 text-[11px] active:translate-y-px',
            active
              ? 'bg-[#2D5A27] text-[#F5F2EB]'
              : 'bg-stone-100 text-stone-800 hover:bg-stone-50'
          )
        : cn(
            'flex-1 min-h-11 border-r border-stone-200 px-2 py-2 text-xs last:border-r-0 active:translate-y-0.5',
            active
              ? 'bg-[#2D5A27] text-[#F5F2EB]'
              : 'bg-stone-100 text-stone-800 hover:bg-stone-50'
          )
    )

  const subLabelClass = (active: boolean) =>
    cn(
      'block font-normal tabular-nums',
      variant === 'inline' ? 'text-[9px] mt-0.5' : 'text-[9px] mt-0.5',
      active ? 'text-[#F5F2EB]/85' : 'text-stone-600'
    )

  const sizeButtons = (
    <div className="space-y-2">
      <div
        className={cn(
          'overflow-hidden rounded-lg border-2 border-stone-200 bg-card',
          variant === 'inline'
            ? 'grid grid-cols-3 gap-px bg-stone-200 sm:grid-cols-5 lg:grid-cols-9'
            : 'flex rounded-xl'
        )}
        role="group"
        aria-label="Vendor booth table length"
      >
        {TABLE_SIZES.map((ft) => {
          const { colSpan, rowSpan } = layoutBaselineGridSpans(ft)
          const option = vendorTableSpec(ft)
          const active = tableSizeSpecsEqual(selection, option)
          return (
            <button
              key={ft}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ft)}
              aria-pressed={active}
              className={buttonClass(active)}
            >
              <span className="block">{ft}′</span>
              <span className={subLabelClass(active)}>
                {colSpan}×{rowSpan}
              </span>
            </button>
          )
        })}
      </div>
      {showGuestOptions ? (
        <>
          <div
            className={cn(
              'overflow-hidden rounded-lg border-2 border-stone-200 bg-card',
              variant === 'inline'
                ? 'grid grid-cols-3 gap-px bg-stone-200'
                : 'flex rounded-xl'
            )}
            role="group"
            aria-label="Guest round tables"
          >
            {GUEST_TABLE_LENGTHS_FT.map((ft) => {
              const option = guestRoundTableSpec(ft)
              const active = tableSizeSpecsEqual(selection, option)
              return (
                <button
                  key={`round-${ft}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(option)}
                  aria-pressed={active}
                  className={buttonClass(active)}
                >
                  <span className="block">{ft}′</span>
                  <span className={subLabelClass(active)}>Round</span>
                </button>
              )
            })}
          </div>
          <div
            className={cn(
              'overflow-hidden rounded-lg border-2 border-stone-200 bg-card',
              variant === 'inline'
                ? 'grid grid-cols-3 gap-px bg-stone-200'
                : 'flex rounded-xl'
            )}
            role="group"
            aria-label="Guest rectangular tables"
          >
            {GUEST_TABLE_LENGTHS_FT.map((ft) => {
              const option = guestRectTableSpec(ft)
              const active = tableSizeSpecsEqual(selection, option)
              return (
                <button
                  key={`rect-${ft}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(option)}
                  aria-pressed={active}
                  className={buttonClass(active)}
                >
                  <span className="block">{ft}′</span>
                  <span className={subLabelClass(active)}>Rect</span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )

  const summaryLabel =
    selection.purpose === 'guest'
      ? selection.shape === 'round'
        ? `${selection.ft}′ round guest table`
        : `${selection.ft}′ rectangular guest table`
      : `${selection.ft}′ vendor booth table`

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'wizard-step2-section2 grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start',
          className
        )}
      >
        <p
          className="text-[10px] font-heading font-semibold uppercase tracking-wide text-muted-foreground sm:pt-2"
          title={labelTitle}
        >
          Table size
        </p>
        <div className="min-w-0 space-y-1.5 sm:col-start-2">
          {sizeButtons}
          <p className="text-[10px] leading-snug text-muted-foreground">
            {showGuestOptions
              ? `Hall baseline — ${summaryLabel}. Booth sizes set venue capacity.`
              : `One size for this hall — ${selection.ft}′ equipment core + 8′ co-aisle on new placements.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'market-panel shrink-0 space-y-2 p-3 min-w-[220px]',
        className
      )}
    >
      <p
        className="font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        title={labelTitle}
      >
        Table size
      </p>
      {sizeButtons}
      <p className="text-[10px] leading-snug text-muted-foreground">
        {showGuestOptions
          ? `Hall baseline — ${summaryLabel}.`
          : `One size for this hall — applies to every table vendor (${selection.ft}′ × 2′ equipment core + 8′ co-aisle).`}
      </p>
    </div>
  )
}
