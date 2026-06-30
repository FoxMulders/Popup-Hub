'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CommandButton } from './command-button'
import { cn } from '@/lib/utils'
import {
  PatronTableSizeRows,
  TableSizePill,
} from './table-size-pill'
import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'

export type CanvasContextMode = 'vendor' | 'patron' | 'align' | null

export interface CanvasContextToolbarProps {
  mode: CanvasContextMode
  tableSizeFt?: TableSizeSpec
  onTableSizeChange?: (selection: TableSizeSpec) => void
  onPrepareTableDraw?: (selection: TableSizeSpec) => void
  roundToolActive?: boolean
  rectToolActive?: boolean
  selectedCount?: number
  onAlignVertical?: () => void
  onAlignHorizontal?: () => void
  onDistributeVertical?: () => void
  onDistributeHorizontal?: () => void
  className?: string
}

/** Contextual size chips and alignment — appears when a draw tool or booth/table is active. */
export function CanvasContextToolbar({
  mode,
  tableSizeFt,
  onTableSizeChange,
  onPrepareTableDraw,
  roundToolActive = false,
  rectToolActive = false,
  selectedCount = 0,
  onAlignVertical,
  onAlignHorizontal,
  onDistributeVertical,
  onDistributeHorizontal,
  className,
}: CanvasContextToolbarProps) {
  if (!mode) return null

  const label =
    mode === 'vendor'
      ? 'Vendor booth size'
      : mode === 'patron'
        ? 'Patron table size'
        : 'Align selection'

  const onSelectSize = (spec: TableSizeSpec) => {
    if (onPrepareTableDraw) {
      onPrepareTableDraw(spec)
      return
    }
    onTableSizeChange?.(spec)
  }

  const canAlign = selectedCount >= 2
  const canDistribute = selectedCount >= 3

  return (
    <Popover defaultOpen>
      <PopoverTrigger
        nativeButton={false}
        className={cn(
          'canvas-context-toolbar pointer-events-auto absolute top-2 left-2 z-20 inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2.5 text-[11px] font-semibold text-stone-800 shadow-md backdrop-blur-sm',
          className
        )}
        aria-label={label}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-auto max-w-[min(90vw,24rem)] p-2"
      >
        {mode === 'vendor' && onTableSizeChange && tableSizeFt ? (
          <TableSizePill
            value={tableSizeFt}
            onChange={onSelectSize}
            sections="vendor"
            compact
            vendorPlacementActive
          />
        ) : null}
        {mode === 'patron' && onTableSizeChange && tableSizeFt ? (
          <PatronTableSizeRows
            value={tableSizeFt}
            onSelectSize={onSelectSize}
            roundToolActive={roundToolActive}
            rectToolActive={rectToolActive}
            compact
          />
        ) : null}
        {mode === 'align' ? (
          <div className="flex flex-wrap items-center gap-0.5">
            {onAlignVertical ? (
              <CommandButton
                onClick={onAlignVertical}
                disabled={!canAlign}
                title="Align vertically"
              >
                <AlignCenterVertical className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
            {onAlignHorizontal ? (
              <CommandButton
                onClick={onAlignHorizontal}
                disabled={!canAlign}
                title="Align horizontally"
              >
                <AlignCenterHorizontal className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
            {onDistributeVertical ? (
              <CommandButton
                onClick={onDistributeVertical}
                disabled={!canDistribute}
                title="Distribute vertically"
              >
                <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
            {onDistributeHorizontal ? (
              <CommandButton
                onClick={onDistributeHorizontal}
                disabled={!canDistribute}
                title="Distribute horizontally"
              >
                <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
