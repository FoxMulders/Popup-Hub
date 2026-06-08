'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sparkles, Calculator, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  type TableLengthOptionFt,
  buildSmartPopulateLimits,
  DEFAULT_TABLE_LENGTH_FT,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import { TABLE_SIZES } from '@/lib/booth-planner/layout-table-size'

interface SmartPopulateBoothCapsProps {
  categories: Category[]
  allowMlm: boolean
  venueWidthFt: number
  venueLengthFt: number
  onVenueWidthChange?: (ft: number) => void
  onVenueLengthChange?: (ft: number) => void
  existingLimits?: CategoryLimit[]
  onPopulate: (limits: CategoryLimit[]) => void
  venueElements?: import('@/types/database').VenueElement[]
  entrance?: 'north' | 'south' | 'east' | 'west'
  /** When true, venue fields are read-only (driven by layout planner room state). */
  venueReadOnly?: boolean
  compact?: boolean
  /** Controlled baseline table length (layout planner drives selector externally). */
  tableLengthFt?: TableLengthOptionFt
  onTableLengthChange?: (ft: TableLengthOptionFt) => void
  /** Hide inline table toggles when parent renders TableSizeSelector. */
  hideTableSizeSelector?: boolean
  /** Block populate when layout has unresolved overlaps or rule failures. */
  actionsBlocked?: boolean
  blockReason?: string
  globalMlmCap?: number
}

export function SmartPopulateBoothCaps({
  categories,
  allowMlm,
  venueWidthFt,
  venueLengthFt,
  onVenueWidthChange,
  onVenueLengthChange,
  existingLimits,
  onPopulate,
  venueReadOnly = false,
  compact = false,
  venueElements,
  entrance = 'south',
  tableLengthFt: controlledTableLengthFt,
  onTableLengthChange,
  hideTableSizeSelector = false,
  actionsBlocked = false,
  blockReason,
  globalMlmCap,
}: SmartPopulateBoothCapsProps) {
  const [internalTableLengthFt, setInternalTableLengthFt] =
    useState<TableLengthOptionFt>(DEFAULT_TABLE_LENGTH_FT)
  const tableLengthFt = controlledTableLengthFt ?? internalTableLengthFt
  const setTableLengthFt = (ft: TableLengthOptionFt) => {
    onTableLengthChange?.(ft)
    if (controlledTableLengthFt === undefined) {
      setInternalTableLengthFt(ft)
    }
  }

  const preview = useMemo(() => {
    if (venueWidthFt <= 0 || venueLengthFt <= 0) return null
    try {
      return buildSmartPopulateLimits({
        venueWidthFt,
        venueLengthFt,
        tableLengthFt,
        categories,
        allowMlm,
        existingLimits,
        venueElements,
        entrance,
        globalMlmCap,
      })
    } catch {
      return null
    }
  }, [venueWidthFt, venueLengthFt, tableLengthFt, categories, allowMlm, existingLimits, venueElements, entrance, globalMlmCap])

  function handlePopulate() {
    if (actionsBlocked) {
      toast.error(blockReason ?? 'Resolve layout conflicts before applying suggested caps')
      return
    }
    if (!preview) {
      toast.error('Enter valid venue width and length first')
      return
    }
    if (preview.breakdown.cMax === 0) {
      toast.warning(
        'Room is too small for a booth under 8′ aisle rules. Increase venue dimensions or reduce clearances in the layout.'
      )
      return
    }
    onPopulate(preview.limits)
    toast.success(
      `Applied ${preview.breakdown.totalAllocated} booth cap${preview.breakdown.totalAllocated === 1 ? '' : 's'} across ${preview.limits.length} categor${preview.limits.length === 1 ? 'y' : 'ies'}`
    )
  }

  const showVenueInputs = !venueReadOnly

  return (
    <div
      className={`rounded-xl border border-sage-200 bg-gradient-to-br from-sage-50/90 to-harvest-50/40 ${
        compact ? 'p-3 space-y-3' : 'p-4 space-y-4'
      }`}
    >
      <div className="flex items-start gap-2">
        <Calculator className={`text-sage-700 shrink-0 ${compact ? 'h-4 w-4 mt-0.5' : 'h-5 w-5'}`} />
        <div>
          <p className={`font-heading font-semibold text-sage-900 ${compact ? 'text-sm' : 'text-base'}`}>
            Suggested category caps
          </p>
          <p className={`text-sage-800/90 leading-relaxed ${compact ? 'text-[11px] mt-0.5' : 'text-xs mt-1'}`}>
            Estimates how many vendor booths fit your floor, then splits them across categories. Adjust
            the numbers below before vendors apply.
          </p>
        </div>
      </div>

      {(showVenueInputs || !hideTableSizeSelector) && (
        <div
          className={`grid gap-3 ${
            showVenueInputs
              ? compact
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-1'
          }`}
        >
          {showVenueInputs ? (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-sage-700">Venue width (ft)</Label>
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={venueWidthFt}
                  onChange={(e) => onVenueWidthChange?.(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-sage-200 bg-card px-2 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-sage-700">Venue length (ft)</Label>
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={venueLengthFt}
                  onChange={(e) => onVenueLengthChange?.(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-sage-200 bg-card px-2 py-1.5 text-sm"
                />
              </div>
            </>
          ) : null}
          {!hideTableSizeSelector && (
            <div className={`space-y-1 ${showVenueInputs ? 'col-span-2 sm:col-span-2' : ''}`}>
              <Label className="text-[10px] uppercase tracking-wide text-sage-700">Table length</Label>
              <div className="flex overflow-hidden rounded-lg border-2 border-stone-200 bg-card">
                {TABLE_SIZES.map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setTableLengthFt(ft)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                      tableLengthFt === ft
                        ? 'bg-sage-600 text-white'
                        : 'text-sage-800 hover:bg-sage-50'
                    }`}
                  >
                    {ft}′ ({ft * 8} sq ft)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-lg border-2 border-stone-200 bg-card/90 px-3 py-2.5 text-xs text-foreground shadow-[var(--shadow-market)]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
              <span className="font-semibold text-sage-900">Max booths</span>
              <span className="font-bold text-harvest-700 tabular-nums">{preview.breakdown.cMax}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
              <span>Usable floor</span>
              <span className="font-medium tabular-nums">
                {preview.breakdown.floor.netUsableSqFt.toLocaleString()} sq ft
                <span className="font-normal text-sage-700"> (after aisles &amp; fixtures)</span>
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
              <span>Suggested split</span>
              <span className="font-medium tabular-nums">
                {preview.breakdown.totalAllocated} cap{preview.breakdown.totalAllocated === 1 ? '' : 's'}{' '}
                across {preview.limits.length} categor{preview.limits.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
          </div>

          <details className="group mt-2 border-t border-sage-100 pt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-sage-800 marker:content-none hover:text-sage-900 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
              How we calculated this
            </summary>
            <div className="mt-2 space-y-1.5 text-sage-800">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <span>Gross floor</span>
                <span className="font-medium tabular-nums">
                  {preview.breakdown.floor.grossSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
                <span>− Fixed fixtures</span>
                <span className="tabular-nums">
                  −{preview.breakdown.floor.structuralDeductionSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
                <span>− Entrances &amp; exits</span>
                <span className="tabular-nums">
                  −{preview.breakdown.floor.doorDeductionSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
                <span>− Main aisle ({preview.breakdown.floor.centralAisleWidthFt}′)</span>
                <span className="tabular-nums">
                  −{preview.breakdown.floor.centralAisleDeductionSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
                <span
                  title="Reserves cross aisles for two-way patron flow plus code-compliant emergency egress."
                >
                  − Walking aisles &amp; fire paths (
                  {Math.round(preview.breakdown.floor.walkwayReserveRatio * 100)}%)
                </span>
                <span className="tabular-nums">
                  −{preview.breakdown.floor.walkwayReserveSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-[10px] text-sage-600">
                <span className="whitespace-normal break-words">
                  Perimeter walls ({preview.breakdown.floor.perimeterWallSqFt.toLocaleString()} sq ft) —
                  vendor seating, not an extra buffer
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-sage-100 pt-1.5">
                <span className="font-semibold">Net usable</span>
                <span className="font-semibold tabular-nums">
                  {preview.breakdown.floor.netUsableSqFt.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <span>Unit footprint</span>
                <span className="font-medium">{preview.breakdown.footprint.label}</span>
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-[10px] text-sage-800 sm:grid-cols-3">
                {preview.breakdown.buckets.map((b) => (
                  <li key={b.key}>
                    {b.label}: <strong>{b.targetSlots}</strong>
                    {b.categoryCount > 0 ? ` (${b.categoryCount} cat.)` : ' — no categories'}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      )}

      <Button
        type="button"
        onClick={handlePopulate}
        disabled={!preview || preview.breakdown.cMax === 0 || actionsBlocked}
        title={
          actionsBlocked
            ? blockReason ?? 'Resolve overlapping booths before applying suggested caps'
            : undefined
        }
        className={`gap-1.5 bg-sage-600 hover:bg-sage-700 text-white ${compact ? 'w-full' : ''}`}
      >
        <Sparkles className="h-4 w-4" />
        Apply suggested caps
      </Button>
    </div>
  )
}
