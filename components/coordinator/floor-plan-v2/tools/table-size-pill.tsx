'use client'

import { Circle, RectangleHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFloorPlanViewportLayout } from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import {
  TABLE_SIZES,
  formatVendorTableSizeButtonLabel,
} from '@/lib/booth-planner/layout-table-size'
import {
  GUEST_TABLE_LENGTHS_FT,
  guestRectTableSpec,
  guestRoundTableSpec,
  tableSizeSpecsEqual,
  vendorTableSpec,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'

export type TableSizePillSections = 'all' | 'vendor' | 'patron' | 'patron-rows'

interface TableSizePillProps {
  value: TableSizeSpec
  onChange: (selection: TableSizeSpec) => void
  /** Which size columns to show — vendor booth, patron round/rect, or all. */
  sections?: TableSizePillSections
  disabled?: boolean
  className?: string
  compact?: boolean
}

export interface PatronTableSizeRowsProps {
  value: TableSizeSpec
  onSelectSize: (selection: TableSizeSpec) => void
  onRoundToolClick?: () => void
  onRectToolClick?: () => void
  roundToolActive?: boolean
  rectToolActive?: boolean
  disabled?: boolean
  compact?: boolean
  className?: string
}

type SizeButtonTone = 'default' | 'patron' | 'vendor'

const TABLET_BOOTH_TOUCH_SIZES_FT = new Set([5, 6, 8])

function boothTabletTouchClass(isTablet: boolean, ft: number): string {
  if (!isTablet || !TABLET_BOOTH_TOUCH_SIZES_FT.has(ft)) return ''
  return 'min-h-11 min-w-11 px-2.5 py-2 touch-manipulation'
}

function sizeButtonClass(
  active: boolean,
  disabled: boolean,
  tone: SizeButtonTone = 'default',
  tabletTouchClass = ''
): string {
  const activeClass =
    tone === 'vendor'
      ? 'bg-forest text-primary-foreground'
      : tone === 'patron'
        ? 'bg-violet-600 text-white'
        : 'bg-sky-600 text-white'
  return cn(
    'inline-flex h-full min-w-[1.85rem] shrink-0 items-center justify-center px-1.5 text-[10px] font-semibold tabular-nums border-r border-stone-200 last:border-r-0 transition-colors sm:min-w-[2rem] sm:px-2 sm:text-[11px]',
    active ? activeClass : 'text-stone-700 hover:bg-stone-100',
    disabled && 'pointer-events-none',
    tabletTouchClass
  )
}

function patronToolIconClass(active: boolean, compact: boolean): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-md border transition-colors',
    compact ? 'h-[1.8rem] w-[1.8rem]' : 'h-8 w-8',
    active
      ? 'border-violet-300 bg-violet-200 text-violet-950'
      : 'border-stone-200 bg-violet-50/80 text-violet-900 hover:bg-violet-100'
  )
}

function GuestTableSizeButtons({
  shape,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  shape: 'round' | 'rectangular'
  value: TableSizeSpec
  onChange: (selection: TableSizeSpec) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'inline-flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700',
        compact ? 'h-[1.8rem]' : 'h-8',
        disabled && 'opacity-60'
      )}
      role="group"
      aria-label={shape === 'round' ? 'Round table sizes' : 'Rectangle table sizes'}
    >
      {GUEST_TABLE_LENGTHS_FT.map((ft) => {
        const selection =
          shape === 'round' ? guestRoundTableSpec(ft) : guestRectTableSpec(ft)
        const active = tableSizeSpecsEqual(value, selection)
        return (
          <button
            key={`${shape}-${ft}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selection)}
            aria-pressed={active}
            title={
              shape === 'round'
                ? `Set guest round table diameter to ${ft} ft`
                : `Set patron banquet table length to ${ft} ft`
            }
            className={sizeButtonClass(active, disabled, 'patron')}
          >
            {ft}′
          </button>
        )
      })}
    </div>
  )
}

/** Patron sidebar — shape toggles on top, active shape sizes beneath. */
export function PatronSidebarControls({
  value,
  onSelectSize,
  onRoundToolClick,
  onRectToolClick,
  roundToolActive = false,
  rectToolActive = false,
  disabled = false,
  compact = false,
  className,
}: PatronTableSizeRowsProps) {
  const activeShape =
    rectToolActive || (value.purpose === 'guest' && value.shape === 'rectangular')
      ? 'rectangular'
      : 'round'

  return (
    <div
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      role="group"
      aria-label="Patron table sizes"
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onRoundToolClick}
          aria-pressed={roundToolActive}
          title="Draw patron round table"
          aria-label="Circle tables"
          className={patronToolIconClass(roundToolActive, compact)}
        >
          <Circle className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onRectToolClick}
          aria-pressed={rectToolActive}
          title="Draw patron banquet table"
          aria-label="Rectangle tables"
          className={patronToolIconClass(rectToolActive, compact)}
        >
          <RectangleHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <GuestTableSizeButtons
        shape={activeShape}
        value={value}
        onChange={onSelectSize}
        disabled={disabled}
        compact={compact}
      />
    </div>
  )
}

/** Vendor sidebar — wrapping size grid with brand highlight on selection. */
export function VendorSidebarSizeGrid({
  value,
  onChange,
  disabled = false,
  compact = false,
  className,
}: {
  value: TableSizeSpec
  onChange: (selection: TableSizeSpec) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}) {
  const { isTablet } = useFloorPlanViewportLayout()

  return (
    <div
      className={cn(
        'grid w-full grid-cols-4 gap-0.5 rounded-md border border-stone-200 bg-white p-0.5',
        compact ? 'text-[10px]' : 'text-[11px]',
        disabled && 'opacity-60',
        className
      )}
      role="group"
      aria-label="Vendor booth sizes"
    >
      {TABLE_SIZES.map((ft) => {
        const selection = vendorTableSpec(ft)
        const active = tableSizeSpecsEqual(value, selection)
        return (
          <button
            key={`booth-sidebar-${ft}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selection)}
            aria-pressed={active}
            title={`Set vendor table length to ${formatVendorTableSizeButtonLabel(ft)}`}
            className={cn(
              'inline-flex min-h-[1.8rem] items-center justify-center rounded-sm px-1 font-semibold tabular-nums transition-colors',
              sizeButtonClass(
                active,
                disabled,
                'vendor',
                boothTabletTouchClass(isTablet, ft)
              ),
              'min-w-0 border-0 last:border-0'
            )}
          >
            {ft}′
          </button>
        )
      })}
    </div>
  )
}

/** Patron layout sidebar — circle row and rectangle row, never wrapped together. */
export function PatronTableSizeRows({
  value,
  onSelectSize,
  onRoundToolClick,
  onRectToolClick,
  roundToolActive = false,
  rectToolActive = false,
  disabled = false,
  compact = false,
  className,
}: PatronTableSizeRowsProps) {
  return (
    <div
      className={cn('flex w-full min-w-0 flex-col gap-0.5', className)}
      role="group"
      aria-label="Patron table sizes"
    >
      <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onRoundToolClick}
          aria-pressed={roundToolActive}
          title="Draw patron round table"
          aria-label="Circle tables"
          className={patronToolIconClass(roundToolActive, compact)}
        >
          <Circle className="h-3.5 w-3.5" aria-hidden />
        </button>
        <GuestTableSizeButtons
          shape="round"
          value={value}
          onChange={onSelectSize}
          disabled={disabled}
          compact={compact}
        />
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onRectToolClick}
          aria-pressed={rectToolActive}
          title="Draw patron banquet table"
          aria-label="Rectangle tables"
          className={patronToolIconClass(rectToolActive, compact)}
        >
          <RectangleHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
        <GuestTableSizeButtons
          shape="rectangular"
          value={value}
          onChange={onSelectSize}
          disabled={disabled}
          compact={compact}
        />
      </div>
    </div>
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
  sections = 'all',
  disabled = false,
  className,
  compact = false,
}: TableSizePillProps) {
  const { isTablet } = useFloorPlanViewportLayout()

  if (sections === 'patron-rows') {
    return (
      <PatronTableSizeRows
        value={value}
        onSelectSize={onChange}
        disabled={disabled}
        compact={compact}
        className={className}
      />
    )
  }

  const showVendor = sections === 'all' || sections === 'vendor'
  const showPatron = sections === 'all' || sections === 'patron'
  const ariaLabel =
    sections === 'vendor'
      ? 'Vendor size'
      : sections === 'patron'
        ? 'Patron table size'
        : 'Table size'

  return (
    <div
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700',
        compact ? 'h-[1.8rem]' : 'h-8',
        disabled && 'opacity-60',
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {sections === 'all' ? (
        <span
          className="hidden items-center px-2 text-[10px] font-heading uppercase tracking-wide text-stone-500 sm:inline-flex"
          aria-hidden
        >
          Table size
        </span>
      ) : null}
      <div
        className={cn(
          'flex h-full max-w-[min(100%,42rem)] overflow-x-auto',
          sections === 'all' && 'sm:border-l sm:border-stone-200'
        )}
      >
        {showVendor ? (
          <>
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
                  title={`Set vendor table length to ${formatVendorTableSizeButtonLabel(ft)}`}
                  className={sizeButtonClass(
                    active,
                    disabled,
                    'vendor',
                    boothTabletTouchClass(isTablet, ft)
                  )}
                >
                  {ft}′
                </button>
              )
            })}
          </>
        ) : null}
        {showPatron ? (
          <>
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
                  className={sizeButtonClass(active, disabled, 'patron')}
                >
                  {ft}′
                </button>
              )
            })}
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
                  title={`Set patron banquet table length to ${ft} ft`}
                  className={sizeButtonClass(active, disabled, 'patron')}
                >
                  {ft}′
                </button>
              )
            })}
          </>
        ) : null}
      </div>
    </div>
  )
}
