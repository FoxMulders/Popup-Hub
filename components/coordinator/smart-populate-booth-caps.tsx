'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sparkles, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  TABLE_LENGTH_OPTIONS_FT,
  type TableLengthOptionFt,
  buildSmartPopulateLimits,
  DEFAULT_TABLE_LENGTH_FT,
} from '@/lib/booth-planner/smart-populate-booth-caps'

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
      toast.error(blockReason ?? 'Resolve layout conflicts before populating booth caps')
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
      `Populated ${preview.breakdown.totalAllocated} booth cap${preview.breakdown.totalAllocated === 1 ? '' : 's'} across ${preview.limits.length} categories (C_max = ${preview.breakdown.cMax})`
    )
  }

  return (
    <div
      className={`rounded-xl border border-sage-200 bg-gradient-to-br from-sage-50/90 to-amber-50/40 ${
        compact ? 'p-3 space-y-3' : 'p-4 space-y-4'
      }`}
    >
      <div className="flex items-start gap-2">
        <Calculator className={`text-sage-700 shrink-0 ${compact ? 'h-4 w-4 mt-0.5' : 'h-5 w-5'}`} />
        <div>
          <p className={`font-heading font-semibold text-sage-900 ${compact ? 'text-sm' : 'text-base'}`}>
            Smart Populate Layout
          </p>
          <p className={`text-sage-800/90 leading-relaxed ${compact ? 'text-[11px] mt-0.5' : 'text-xs mt-1'}`}>
            Perimeter wall rows are vendor seating (4′ pocket in booth depth). Net usable deducts only
            structural locks, [E]/[X] doors, and one 8′ customer spine aisle — then divides by{' '}
            {tableLengthFt}′×10′ units (2′ equipment + 8′ aisle) for C_max.
          </p>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-sage-700">Venue width (ft)</Label>
          <input
            type="number"
            min={10}
            step={1}
            readOnly={venueReadOnly}
            value={venueWidthFt}
            onChange={(e) => onVenueWidthChange?.(Number(e.target.value) || 0)}
            className={`w-full rounded-lg border border-sage-200 px-2 py-1.5 text-sm ${
              venueReadOnly ? 'bg-sage-50/80 text-sage-800' : 'bg-card'
            }`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-sage-700">Venue length (ft)</Label>
          <input
            type="number"
            min={10}
            step={1}
            readOnly={venueReadOnly}
            value={venueLengthFt}
            onChange={(e) => onVenueLengthChange?.(Number(e.target.value) || 0)}
            className={`w-full rounded-lg border border-sage-200 px-2 py-1.5 text-sm ${
              venueReadOnly ? 'bg-sage-50/80 text-sage-800' : 'bg-card'
            }`}
          />
        </div>
        {!hideTableSizeSelector && (
          <div className="space-y-1 col-span-2 sm:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-sage-700">Table length</Label>
            <div className="flex rounded-lg border-2 border-stone-200 overflow-hidden bg-card">
              {TABLE_LENGTH_OPTIONS_FT.map((ft) => (
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

      {preview && (
        <div className="rounded-lg border-2 border-stone-200 bg-card/90 px-3 py-2.5 text-xs text-foreground space-y-1.5 shadow-[var(--shadow-market)]">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
            <span>Gross floor</span>
            <span className="font-medium tabular-nums">{preview.breakdown.floor.grossSqFt.toLocaleString()} sq ft</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
            <span>− Structural locks [L]</span>
            <span className="tabular-nums">
              −{preview.breakdown.floor.structuralDeductionSqFt.toLocaleString()} sq ft
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
            <span>− Doors [E]/[X]</span>
            <span className="tabular-nums">
              −{preview.breakdown.floor.doorDeductionSqFt.toLocaleString()} sq ft
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sage-700">
            <span>− Customer spine aisle ({preview.breakdown.floor.centralAisleWidthFt}′)</span>
            <span className="tabular-nums">
              −{preview.breakdown.floor.centralAisleDeductionSqFt.toLocaleString()} sq ft
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-[10px] text-sage-600">
            <span className="whitespace-normal break-words">
              Perimeter [W] ({preview.breakdown.floor.perimeterWallSqFt.toLocaleString()} sq ft) — vendor
              seating, not an extra 8′ buffer
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
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-base">
            <span className="font-bold text-sage-900">C_max (max booths)</span>
            <span className="font-bold text-amber-800 tabular-nums">{preview.breakdown.cMax}</span>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-0.5 pt-1 text-[10px] text-sage-800">
            {preview.breakdown.buckets.map((b) => (
              <li key={b.key}>
                {b.label}: <strong>{b.targetSlots}</strong>
                {b.categoryCount > 0 ? ` (${b.categoryCount} cat.)` : ' — no categories'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        type="button"
        onClick={handlePopulate}
        disabled={!preview || preview.breakdown.cMax === 0 || actionsBlocked}
        title={
          actionsBlocked
            ? blockReason ?? 'Resolve overlapping booths before populating'
            : undefined
        }
        className={`gap-1.5 bg-sage-600 hover:bg-sage-700 text-white ${compact ? 'w-full' : ''}`}
      >
        <Sparkles className="h-4 w-4" />
        Populate layout & booth caps
      </Button>
    </div>
  )
}
