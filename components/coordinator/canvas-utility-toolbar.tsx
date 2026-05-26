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
}

const UTILITY_BTN =
  'inline-flex items-center gap-1 rounded-none border-2 border-black bg-white px-2 text-xs font-black text-black min-h-9 hover:bg-zinc-100 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40'

export function CanvasUtilityToolbar({
  canUndo,
  canRedo,
  onLockAll,
  onClear,
  onUndo,
  onRedo,
  onRemove,
  onStripPresetPaint,
}: CanvasUtilityToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Canvas utilities">
      <TooltipWrapper text="Lock every fixture so template and painted items cannot be erased · Ctrl+L">
        <button type="button" onClick={onLockAll} className={UTILITY_BTN}>
          <Lock className="h-3.5 w-3.5" />
          Lock
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Remove all vendors and painted fixtures — locked shell stays · Ctrl+Alt+C">
        <button type="button" onClick={onClear} className={UTILITY_BTN}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Reverse the last canvas change · Ctrl+Z">
        <button type="button" disabled={!canUndo} onClick={onUndo} className={cn(UTILITY_BTN)}>
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Reapply an undone change · Ctrl+Y / Ctrl+Shift+Z">
        <button type="button" disabled={!canRedo} onClick={onRedo} className={cn(UTILITY_BTN)}>
          <Redo2 className="h-3.5 w-3.5" />
          Redo
        </button>
      </TooltipWrapper>
      <TooltipWrapper text="Erase vendors, preset aisles, and painted fixtures · Delete / Backspace / R">
        <button type="button" onClick={onRemove} className={UTILITY_BTN}>
          <Eraser className="h-3.5 w-3.5" />
          Remove
        </button>
      </TooltipWrapper>
      {onStripPresetPaint ? (
        <TooltipWrapper text="Wipe everything to a bare grid so you can draw your own walls (Wall / Column tool) and outline a custom usable area before placing fixtures">
          <button type="button" onClick={onStripPresetPaint} className={UTILITY_BTN}>
            <PaintBucket className="h-3.5 w-3.5" />
            Bare grid
          </button>
        </TooltipWrapper>
      ) : null}
    </div>
  )
}
