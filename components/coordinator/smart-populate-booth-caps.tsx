'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sparkles, Calculator, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  type TableLengthOptionFt,
  buildSmartPopulateLimits,
  DEFAULT_TABLE_LENGTH_FT,
  type SmartPopulateBreakdown,
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
  /** When true, venue fields follow the venue template unless manual entry is on. */
  venueReadOnly?: boolean
  /** Controlled manual-entry toggle (wizard Step 2). */
  venueManualEntry?: boolean
  onVenueManualEntryChange?: (manual: boolean) => void
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

function FloorCalculationBreakdown({ breakdown }: { breakdown: SmartPopulateBreakdown }) {
  const { floor, footprint } = breakdown

  return (
    <div className="space-y-1.5 text-left text-xs">
      <p className="font-semibold text-foreground">How we calculated usable floor</p>
      <div className="flex justify-between gap-4">
        <span>Gross floor</span>
        <span className="font-medium tabular-nums">{floor.grossSqFt.toLocaleString()} sq ft</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>− Fixed fixtures</span>
        <span className="tabular-nums">−{floor.structuralDeductionSqFt.toLocaleString()} sq ft</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>− Entrances &amp; exits</span>
        <span className="tabular-nums">−{floor.doorDeductionSqFt.toLocaleString()} sq ft</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>− Main aisle ({floor.centralAisleWidthFt}′)</span>
        <span className="tabular-nums">−{floor.centralAisleDeductionSqFt.toLocaleString()} sq ft</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>− Walking aisles &amp; fire paths ({Math.round(floor.walkwayReserveRatio * 100)}%)</span>
        <span className="tabular-nums">−{floor.walkwayReserveSqFt.toLocaleString()} sq ft</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Perimeter walls ({floor.perimeterWallSqFt.toLocaleString()} sq ft) — vendor seating, not an
        extra buffer
      </p>
      <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold">
        <span>Net usable</span>
        <span className="tabular-nums">{floor.netUsableSqFt.toLocaleString()} sq ft</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>Unit footprint</span>
        <span className="font-medium">{footprint.label}</span>
      </div>
      <ul className="grid grid-cols-1 gap-0.5 pt-1 text-[10px] text-muted-foreground">
        {breakdown.buckets.map((b) => (
          <li key={b.key}>
            {b.label}: <strong className="text-foreground">{b.targetSlots}</strong>
            {b.categoryCount > 0 ? ` (${b.categoryCount} cat.)` : ' — no categories'}
          </li>
        ))}
      </ul>
    </div>
  )
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
  venueManualEntry: controlledManualEntry,
  onVenueManualEntryChange,
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
  const [internalManualEntry, setInternalManualEntry] = useState(false)
  const manualEntry = controlledManualEntry ?? internalManualEntry
  const setManualEntry = (next: boolean) => {
    onVenueManualEntryChange?.(next)
    if (controlledManualEntry === undefined) {
      setInternalManualEntry(next)
    }
  }

  const [widthDraft, setWidthDraft] = useState(String(venueWidthFt))
  const [lengthDraft, setLengthDraft] = useState(String(venueLengthFt))
  useEffect(() => {
    setWidthDraft(String(venueWidthFt))
    setLengthDraft(String(venueLengthFt))
  }, [venueWidthFt, venueLengthFt])

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

  const showVenueInputs = true
  const venueInputsEditable = manualEntry || !venueReadOnly

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

      {venueReadOnly ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-sage-200/80 bg-white/70 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-sage-900">Floor dimensions</p>
            <p className="text-[10px] text-sage-800/80">
              {manualEntry
                ? 'Manual entry — type custom width and length below.'
                : 'Auto — using your venue template dimensions.'}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-[10px] font-medium text-sage-800">
            <span>Manual entry</span>
            <Switch
              checked={manualEntry}
              onCheckedChange={setManualEntry}
              aria-label="Toggle manual venue dimension entry"
            />
          </label>
        </div>
      ) : null}

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
                  value={widthDraft}
                  readOnly={!venueInputsEditable}
                  disabled={!venueInputsEditable}
                  onChange={(e) => {
                    const next = e.target.value
                    setWidthDraft(next)
                    const parsed = Number(next)
                    if (Number.isFinite(parsed) && parsed > 0) {
                      onVenueWidthChange?.(parsed)
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(widthDraft)
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      setWidthDraft(String(venueWidthFt))
                    }
                  }}
                  className="w-full rounded-lg border border-sage-200 bg-card px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-sage-700">Venue length (ft)</Label>
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={lengthDraft}
                  readOnly={!venueInputsEditable}
                  disabled={!venueInputsEditable}
                  onChange={(e) => {
                    const next = e.target.value
                    setLengthDraft(next)
                    const parsed = Number(next)
                    if (Number.isFinite(parsed) && parsed > 0) {
                      onVenueLengthChange?.(parsed)
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(lengthDraft)
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      setLengthDraft(String(venueLengthFt))
                    }
                  }}
                  className="w-full rounded-lg border border-sage-200 bg-card px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
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
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                Usable floor
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="inline-flex rounded-sm text-sage-700 hover:text-sage-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
                    aria-label="How we calculated usable floor"
                  >
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-sm p-3">
                    <FloorCalculationBreakdown breakdown={preview.breakdown} />
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className="font-medium tabular-nums">
                {preview.breakdown.floor.netUsableSqFt.toLocaleString()} sq ft
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
              <span>Suggested split</span>
              <span className="font-medium tabular-nums">
                {preview.breakdown.totalAllocated} cap
                {preview.breakdown.totalAllocated === 1 ? '' : 's'} across {preview.limits.length}{' '}
                categor{preview.limits.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
          </div>
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
