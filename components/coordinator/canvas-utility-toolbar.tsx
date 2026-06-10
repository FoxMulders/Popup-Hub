'use client'

import { Eraser, Lock, PaintBucket, Redo2, Trash2, Undo2 } from 'lucide-react'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'

interface CanvasUtilityToolbarProps {
  canUndo: boolean
  canRedo: boolean
  onLockAll: () => void
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  onRemove: () => void
  onStripPresetPaint?: () => void
  /** True when the canvas is currently in Bare-Grid (unmanaged) mode. */
  bareGridActive?: boolean
}

const UTILITY_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white p-0 text-stone-700 shadow-sm hover:bg-stone-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40'

export function CanvasUtilityToolbar({
  canUndo,
  canRedo,
  onLockAll,
  onClear,
  onUndo,
  onRedo,
  onRemove,
  onStripPresetPaint,
  bareGridActive = false,
}: CanvasUtilityToolbarProps) {
  return (
    <div
      className="dashboard-toolbar-section inline-flex flex-wrap items-center gap-1 rounded-lg border border-stone-200/80 bg-stone-50/80 p-0.5"
      role="toolbar"
      aria-label="Canvas utilities"
    >
      <TooltipWrapper text="Lock all — lock every fixture so template and painted items cannot be erased · Ctrl+L">
        <button type="button" onClick={onLockAll} className={UTILITY_BTN} aria-label="Lock all">
          <Lock className="h-3.5 w-3.5" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Clear — remove all vendors and painted fixtures; locked shell stays · Ctrl+Alt+C">
        <button type="button" onClick={onClear} className={UTILITY_BTN} aria-label="Clear canvas">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Undo — reverse the last canvas change · Ctrl+Z">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={cn(UTILITY_BTN)}
          aria-label="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Redo — reapply an undone change · Ctrl+Y / Ctrl+Shift+Z">
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className={cn(UTILITY_BTN)}
          aria-label="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Remove — erase vendors, preset aisles, and painted fixtures · Delete / Backspace / R">
        <button type="button" onClick={onRemove} className={UTILITY_BTN} aria-label="Remove">
          <Eraser className="h-3.5 w-3.5" />
        </button>
      </TooltipWrapper>
      {onStripPresetPaint ? (
        <TooltipWrapper
          text={
            bareGridActive
              ? 'Bare-Grid is ON — strict validation suspended. Click to re-enable clearance, aisle, and pathfinding rules.'
              : 'Bare-Grid mode: wipes the canvas and suspends clearance / aisle / pathfinding validation so you can draw walls and place objects anywhere.'
          }
        >
          <button
            type="button"
            onClick={onStripPresetPaint}
            aria-pressed={bareGridActive}
            aria-label={bareGridActive ? 'Bare grid on' : 'Bare grid'}
            className={cn(
              UTILITY_BTN,
              bareGridActive && 'border-harvest-400 bg-harvest-100 text-harvest-900'
            )}
          >
            <PaintBucket className="h-3.5 w-3.5" />
          </button>
        </TooltipWrapper>
      ) : null}
    </div>
  )
}
