'use client'

import {
  ArrowUpRight,
  ClipboardPaste,
  Copy,
  DoorOpen,
  Hand,
  LayoutGrid,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Siren,
  Square,
  Tag,
  Trash2,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DrawShape, ToolId, ToolState } from './types'

interface ToolPaletteProps {
  toolState: ToolState
  onToolChange: (tool: ToolId) => void
  onDrawShapeChange: (shape: DrawShape) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClearAll: () => void
  selectedCount: number
  onDeleteSelected: () => void
  /** Copy selected objects into the floor-plan clipboard. */
  onCopy: () => void
  /** Paste the floor-plan clipboard contents back onto the canvas. */
  onPaste: () => void
  /** Whether the clipboard currently has contents to paste. */
  clipboardHasContents: boolean
  /** Rotate the current selection -15°. */
  onRotateLeft: () => void
  /** Rotate the current selection +15°. */
  onRotateRight: () => void
  /** Current canvas zoom (1.0 = 100%). Driven by the canvas viewport. */
  zoom: number
  /** Zoom out one step. */
  onZoomOut: () => void
  /** Zoom in one step. */
  onZoomIn: () => void
  /** Reset zoom to 100% (anchored on selection or canvas center). */
  onZoomReset: () => void
  /** Run the auto-arrange engine on the current booth list. */
  onAutoArrange?: () => void
  /** Whether the canvas currently has at least one booth to re-pack. */
  canAutoArrange?: boolean
  className?: string
}

interface ToolButton {
  id: ToolId
  label: string
  shortcut: string
  icon: React.ComponentType<{ className?: string }>
}

const TOOLS: ToolButton[] = [
  { id: 'hand', label: 'Hand · pan', shortcut: 'H', icon: Hand },
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'draw', label: 'Draw', shortcut: 'D', icon: Pencil },
]

interface ShapeButton {
  id: DrawShape
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SHAPES: ShapeButton[] = [
  { id: 'booth', label: 'Booth', icon: Square },
  { id: 'wall', label: 'Wall', icon: Square },
  { id: 'aisle', label: 'Aisle', icon: ArrowUpRight },
  { id: 'door', label: 'Door', icon: DoorOpen },
  { id: 'emergency_exit', label: 'Exit', icon: Siren },
  { id: 'stage', label: 'Stage', icon: Square },
  { id: 'label', label: 'Label', icon: Tag },
]

export function ToolPalette({
  toolState,
  onToolChange,
  onDrawShapeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
  selectedCount,
  onDeleteSelected,
  onCopy,
  onPaste,
  clipboardHasContents,
  onRotateLeft,
  onRotateRight,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  onAutoArrange,
  canAutoArrange,
  className,
}: ToolPaletteProps) {
  const hasSelection = selectedCount > 0
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm',
        className
      )}
      role="toolbar"
      aria-label="Floor plan tools"
    >
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const active = toolState.tool === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToolChange(t.id)}
              aria-pressed={active}
              title={`${t.label} (${t.shortcut})`}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold',
                active
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {toolState.tool === 'draw' ? (
        <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
            Shape
          </span>
          {SHAPES.map((s) => {
            const active = toolState.drawShape === s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onDrawShapeChange(s.id)}
                aria-pressed={active}
                title={s.label}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold',
                  active
                    ? 'bg-amber-200 text-amber-900'
                    : 'text-stone-600 hover:bg-stone-100'
                )}
              >
                <Icon className="h-3 w-3" />
                {s.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {/*
        Copy / Paste / Rotate cluster. Mirrors the keyboard shortcuts
        (Ctrl+C, Ctrl+V, R / Shift+R) so touch and mobile users can
        access the same operations without a keyboard.
      */}
      <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={!hasSelection}
          title={`Copy ${selectedCount || ''} selected (Ctrl+C)`.trim()}
          aria-label="Copy selection"
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
        >
          <Copy className="h-3 w-3" />
          <span className="hidden sm:inline">Copy</span>
        </button>
        <button
          type="button"
          onClick={onPaste}
          disabled={!clipboardHasContents}
          title={
            clipboardHasContents
              ? 'Paste from clipboard (Ctrl+V)'
              : 'Clipboard is empty'
          }
          aria-label="Paste from clipboard"
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
        >
          <ClipboardPaste className="h-3 w-3" />
          <span className="hidden sm:inline">Paste</span>
        </button>
        <button
          type="button"
          onClick={onRotateLeft}
          disabled={!hasSelection}
          title="Rotate -15° (Shift+R)"
          aria-label="Rotate selection left 15 degrees"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRotateRight}
          disabled={!hasSelection}
          title="Rotate +15° (R)"
          aria-label="Rotate selection right 15 degrees"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {onAutoArrange ? (
        <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
          <button
            type="button"
            onClick={onAutoArrange}
            disabled={!canAutoArrange}
            title="Auto-Arrange — re-pack booths with clearance rules"
            aria-label="Auto-arrange booths"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-100 px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-40"
          >
            <LayoutGrid className="h-3 w-3" />
            <span className="hidden sm:inline">Auto-Arrange</span>
          </button>
        </div>
      ) : null}

      {/*
        Zoom cluster — moved off the canvas overlay so the controls
        live alongside the rest of the toolbar and don't compete with
        the inspector / property panel for screen real estate.
      */}
      <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Reset zoom"
          aria-label="Reset zoom to 100%"
          className="inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1 border-l border-stone-200 pl-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          title={`Delete ${selectedCount} selected`}
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
        <button
          type="button"
          onClick={onClearAll}
          title="Clear canvas (no preset will be applied)"
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100"
        >
          Clear all
        </button>
      </div>
    </div>
  )
}
