'use client'

import { useState } from 'react'
import { PlacedVendorsPanel } from '@/components/coordinator/placed-vendors-panel'
import { UnplacedVendorsPanel } from '@/components/coordinator/unplaced-vendors-panel'
import type { BoothCell } from '@/types/database'
import { cn } from '@/lib/utils'

interface FloorPlanInventoryPanelProps {
  placed: BoothCell[]
  unplaced: BoothCell[]
  activeTool: string
  selectedId: string | null
  cellWidthFt: number
  cellLengthFt: number
  isOneFootGrid: boolean
  onSelect: (id: string) => void
  onUnplace: (cell: BoothCell) => void
  onRemove: (cell: BoothCell) => void
  onDragStart: (e: React.DragEvent, cell: BoothCell) => void
  /** Lower-case names of categories flagged is_mlm in the catalog. */
  mlmCategoryNames?: Set<string>
}

export function FloorPlanInventoryPanel({
  placed,
  unplaced,
  activeTool,
  selectedId,
  cellWidthFt,
  cellLengthFt,
  isOneFootGrid,
  onSelect,
  onUnplace,
  onRemove,
  onDragStart,
  mlmCategoryNames,
}: FloorPlanInventoryPanelProps) {
  const [tab, setTab] = useState<'unplaced' | 'placed'>(unplaced.length > 0 ? 'unplaced' : 'placed')

  if (placed.length === 0 && unplaced.length === 0) {
    return (
      <div className="market-panel p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add test vendors or auto-arrange booths to build your booth inventory.
        </p>
      </div>
    )
  }

  return (
    <div className="market-panel flex min-h-0 flex-col overflow-hidden">
      <div className="flex border-b border-stone-200" role="tablist" aria-label="Booth inventory">
        {(['unplaced', 'placed'] as const).map((key) => {
          const count = key === 'unplaced' ? unplaced.length : placed.length
          if (count === 0 && key === 'placed' && unplaced.length > 0) return null
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                tab === key
                  ? 'border-b-2 border-forest text-forest bg-forest/5'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {key === 'unplaced' ? 'Unplaced' : 'Placed'} ({count})
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'unplaced' && unplaced.length > 0 ? (
          <UnplacedVendorsPanel
            embedded
            vendors={unplaced}
            activeTool={activeTool}
            selectedId={selectedId}
            cellWidthFt={cellWidthFt}
            cellLengthFt={cellLengthFt}
            isOneFootGrid={isOneFootGrid}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onRemove={onRemove}
            mlmCategoryNames={mlmCategoryNames}
          />
        ) : null}
        {tab === 'placed' && placed.length > 0 ? (
          <PlacedVendorsPanel
            embedded
            vendors={placed}
            selectedId={selectedId}
            cellWidthFt={cellWidthFt}
            cellLengthFt={cellLengthFt}
            isOneFootGrid={isOneFootGrid}
            onSelect={onSelect}
            onUnplace={onUnplace}
            onRemove={onRemove}
            mlmCategoryNames={mlmCategoryNames}
          />
        ) : null}
      </div>
    </div>
  )
}
