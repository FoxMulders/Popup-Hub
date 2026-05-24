'use client'

import { X } from 'lucide-react'
import { formatBoothFootprint } from '@/lib/booth-planner/grid-scale'
import { isTentVendor, vendorUnitLabel } from '@/lib/booth-planner/vendor-unit-types'
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
}

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
}: UnplacedVendorsPanelProps) {
  if (vendors.length === 0) return null

  const canDrag = activeTool === 'vendor'

  return (
    <div className="w-56 market-panel p-4 space-y-3">
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
        {vendors.map((cell) => (
          <div
            key={cell.id}
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, cell)}
            onClick={() => onSelect(cell.id)}
            className={`relative rounded-lg border px-2 py-2 pr-7 text-xs cursor-pointer transition-shadow ${
              cell.categoryColor
            } ${selectedId === cell.id ? 'ring-2 ring-forest shadow-md' : 'hover:shadow-sm'} ${
              canDrag ? 'active:cursor-grabbing' : ''
            }`}
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
            <p className="font-semibold truncate">{cell.vendorName}</p>
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
        ))}
      </div>
    </div>
  )
}
