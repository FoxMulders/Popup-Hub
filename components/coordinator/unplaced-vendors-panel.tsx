'use client'

import { X } from 'lucide-react'
import { formatBoothFootprint } from '@/lib/booth-planner/grid-scale'
import { isTentVendor, vendorUnitLabel } from '@/lib/booth-planner/vendor-unit-types'
import { cn } from '@/lib/utils'
import type { BoothCell } from '@/types/database'

interface UnplacedVendorsPanelProps {
  vendors: BoothCell[]
  activeTool: string
  selectedId: string | null
  cellWidthFt: number
  cellLengthFt: number
  isOneFootGrid: boolean
  onSelect: (id: string) => void
  onDragStart: (e: React.DragEvent, cell: BoothCell) => void
  onRemove: (cell: BoothCell) => void
  /** Lower-case names of categories flagged is_mlm on the catalog. */
  mlmCategoryNames?: Set<string>
  /** Full-width embed inside floor-plan inventory tabs. */
  embedded?: boolean
}

const ROW_STRIPE_EVEN = 'bg-card'
const ROW_STRIPE_ODD = 'bg-stone-50'

function boothLabel(boothNumber: number): string {
  return boothNumber > 0 ? `#${boothNumber}` : 'Unassigned'
}

function layoutFootprint(
  cell: BoothCell,
  cellWidthFt: number,
  cellLengthFt: number
): string {
  return formatBoothFootprint(cell.colSpan, cell.rowSpan, cellWidthFt, cellLengthFt)
}

function layoutUnitLabel(cell: BoothCell, isOneFootGrid: boolean): string {
  const unplaced = cell.col < 0
  const tableDirection =
    !unplaced &&
    !isTentVendor(cell.vendorUnitType) &&
    isOneFootGrid &&
    cell.tableOrientation
      ? cell.tableOrientation
      : null
  return vendorUnitLabel(cell.vendorUnitType, cell.tableLengthFt, tableDirection)
}

export function UnplacedVendorsPanel({
  vendors,
  activeTool,
  selectedId,
  cellWidthFt,
  cellLengthFt,
  isOneFootGrid,
  onSelect,
  onDragStart,
  onRemove,
  mlmCategoryNames,
  embedded = false,
}: UnplacedVendorsPanelProps) {
  if (vendors.length === 0) return null

  const canDrag = activeTool === 'vendor'

  return (
    <div className={embedded ? 'space-y-2 p-2' : 'w-56 market-panel p-4 space-y-3'}>
      <div>
        <p className="text-xs font-semibold text-terracotta-700 uppercase">
          Unplaced ({vendors.length})
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          {canDrag
            ? 'Drag onto an open grid cell, or select one then click a cell. Use × to remove from the plan.'
            : 'Switch to Move Vendors to drag or click-to-place.'}
        </p>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {vendors.map((cell, index) => {
          const isMlm = Boolean(
            mlmCategoryNames && cell.categoryName && mlmCategoryNames.has(cell.categoryName.toLowerCase())
          )
          const stripe = index % 2 === 0 ? ROW_STRIPE_EVEN : ROW_STRIPE_ODD
          return (
          <div
            key={cell.id}
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, cell)}
            onClick={() => onSelect(cell.id)}
            className={cn(
              'relative rounded-lg border px-2 py-2 pr-7 text-xs cursor-pointer transition-shadow',
              cell.categoryColor || stripe,
              selectedId === cell.id ? 'ring-2 ring-forest shadow-md' : 'hover:shadow-sm',
              canDrag ? 'active:cursor-grabbing' : ''
            )}
          >
            <button
              type="button"
              title="Remove from layout plan"
              aria-label={`Remove ${cell.vendorName}`}
              className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground hover:bg-white/80 hover:text-red-600"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onRemove(cell)
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="flex items-center gap-1.5 font-semibold">
              <span className="truncate">{cell.vendorName}</span>
              {isMlm ? (
                <span
                  className="shrink-0 rounded bg-terracotta-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-terracotta-800 ring-1 ring-terracotta-200/80"
                  title="Multi-Level Marketing brand"
                  aria-label="MLM category"
                >
                  MLM
                </span>
              ) : null}
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] opacity-80 leading-snug">
              <dt className="text-muted-foreground">Booth</dt>
              <dd className="truncate tabular-nums">{boothLabel(cell.boothNumber)}</dd>
              <dt className="text-muted-foreground">Unit</dt>
              <dd className="truncate">{layoutUnitLabel(cell, isOneFootGrid)}</dd>
              <dt className="text-muted-foreground">Footprint</dt>
              <dd className="truncate tabular-nums">
                {layoutFootprint(cell, cellWidthFt, cellLengthFt)}
              </dd>
            </dl>
          </div>
          )
        })}
      </div>
    </div>
  )
}
