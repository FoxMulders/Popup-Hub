'use client'

import { X } from 'lucide-react'
import { formatBoothFootprint } from '@/lib/booth-planner/grid-scale'
import { isTentVendor, vendorUnitLabel } from '@/lib/booth-planner/vendor-unit-types'
import type { BoothCell } from '@/types/database'

interface PlacedVendorsPanelProps {
  vendors: BoothCell[]
  selectedId: string | null
  cellWidthFt: number
  cellLengthFt: number
  isOneFootGrid: boolean
  onSelect: (id: string) => void
  onUnplace: (cell: BoothCell) => void
  onRemove: (cell: BoothCell) => void
}

function boothLabel(boothNumber: number): string {
  return boothNumber > 0 ? `#${boothNumber}` : 'Unassigned'
}

export function PlacedVendorsPanel({
  vendors,
  selectedId,
  cellWidthFt,
  cellLengthFt,
  isOneFootGrid,
  onSelect,
  onUnplace,
  onRemove,
}: PlacedVendorsPanelProps) {
  if (vendors.length === 0) return null

  return (
    <div className="w-56 market-panel p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-forest uppercase">
          Placed ({vendors.length})
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Move to sidebar with × or remove from the plan entirely. Use Remove (R) on preset aisles
          and fixtures on the canvas.
        </p>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {vendors.map((cell) => {
          const tableDirection =
            !isTentVendor(cell.vendorUnitType) && isOneFootGrid && cell.tableOrientation
              ? cell.tableOrientation
              : null
          return (
            <div
              key={cell.id}
              onClick={() => onSelect(cell.id)}
              className={`relative rounded-lg border px-2 py-2 pr-14 text-xs cursor-pointer transition-shadow ${
                cell.categoryColor
              } ${selectedId === cell.id ? 'ring-2 ring-forest shadow-md' : 'hover:shadow-sm'}`}
            >
              <div className="absolute top-1 right-1 flex gap-0.5">
                <button
                  type="button"
                  title="Unplace (move to sidebar)"
                  aria-label={`Unplace ${cell.vendorName}`}
                  className="rounded p-0.5 text-muted-foreground hover:bg-white/80 hover:text-terracotta-700"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnplace(cell)
                  }}
                >
                  <span className="text-[9px] font-bold px-0.5">↩</span>
                </button>
                <button
                  type="button"
                  title="Remove from layout plan"
                  aria-label={`Remove ${cell.vendorName}`}
                  className="rounded p-0.5 text-muted-foreground hover:bg-white/80 hover:text-red-600"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(cell)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="font-semibold truncate">{cell.vendorName}</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] opacity-80 leading-snug">
                <dt className="text-muted-foreground">Booth</dt>
                <dd className="truncate tabular-nums">{boothLabel(cell.boothNumber)}</dd>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="truncate">
                  {vendorUnitLabel(cell.vendorUnitType, cell.tableLengthFt, tableDirection)}
                </dd>
                <dt className="text-muted-foreground">Footprint</dt>
                <dd className="truncate tabular-nums">
                  {formatBoothFootprint(cell.colSpan, cell.rowSpan, cellWidthFt, cellLengthFt)}
                </dd>
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}
