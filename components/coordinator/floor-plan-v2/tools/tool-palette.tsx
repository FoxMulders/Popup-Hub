'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowUpRight,
  ClipboardPaste,
  Copy,
  DoorOpen,
  Hand,
  LayoutGrid,
  Locate,
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
  /**
   * Snap selected objects' geometric centers onto a single vertical
   * axis (the median X of the selection). Requires ≥ 2 selected
   * objects; the host enforces this and toasts a hint otherwise.
   */
  onAlignVertical: () => void
  /**
   * Snap selected objects' geometric centers onto a single horizontal
   * axis (the median Y of the selection). Requires ≥ 2 selected.
   */
  onAlignHorizontal: () => void
  /** Current canvas zoom (1.0 = 100%). Driven by the canvas viewport. */
  zoom: number
  /** Zoom out one step. */
  onZoomOut: () => void
  /** Zoom in one step. */
  onZoomIn: () => void
  /** Reset zoom to 100% (anchored on selection or canvas center). */
  onZoomReset: () => void
  /**
   * Recenter the viewport on the canvas / current selection without
   * forcing a zoom delta. Distinct from `onZoomReset` so users who
   * have panned but not zoomed can recover framing with one click.
   */
  onCenterView: () => void
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

/**
 * "View / selection" cluster — the *non-mutating* tools. Picking one of
 * these never changes the floor plan document; it just changes how the
 * canvas itself responds to pointer/keyboard input.
 */
const VIEW_TOOLS: ToolButton[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
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

/**
 * Renders a small uppercase caption above each visual zone so the
 * toolbar reads as a series of labelled tool groups instead of an
 * undifferentiated row. The caption sits visually attached to the
 * group below it via a tighter top margin and a thin separator pipe.
 */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden select-none text-[9px] font-bold uppercase tracking-[0.08em] text-stone-400 sm:inline">
      {children}
    </span>
  )
}

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
  onAlignVertical,
  onAlignHorizontal,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  onCenterView,
  onAutoArrange,
  canAutoArrange,
  className,
}: ToolPaletteProps) {
  const hasSelection = selectedCount > 0
  const canAlign = selectedCount >= 2
  const drawActive = toolState.tool === 'draw'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm',
        className
      )}
      role="toolbar"
      aria-label="Floor plan tools"
    >
      {/*
        Group 1 — VIEW / SELECTION.
        Non-mutating canvas state modifiers: choose how pointer input
        is interpreted (Select vs. Hand-pan), recenter the framing,
        adjust zoom. Lives at the *left* of the toolbar so the eye
        first lands on "what mode am I in" before reaching for any
        editing action.
      */}
      <div className="flex items-center gap-1.5">
        <GroupLabel>View</GroupLabel>
        <div className="flex items-center gap-1" role="group" aria-label="View tools">
          {VIEW_TOOLS.map((t) => {
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
          <button
            type="button"
            onClick={onCenterView}
            title="Center view — frame every placed object in the viewport"
            aria-label="Center view on all placed objects"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            <Locate className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Center</span>
          </button>
          <div
            className="ml-1 inline-flex h-8 items-center overflow-hidden rounded-md border border-stone-200"
            role="group"
            aria-label="Zoom"
          >
            <button
              type="button"
              onClick={onZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              title="Reset zoom to 100%"
              aria-label="Reset zoom to 100 percent"
              className="inline-flex h-full min-w-[3rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-7 w-px bg-stone-200" aria-hidden />

      {/*
        Group 2 — STRUCTURE / DRAW.
        Switches the canvas into draw mode and picks the kind of
        object the next gesture will create. The shape pills are
        only revealed when Draw is the active tool — this keeps the
        toolbar visually quiet while the user is selecting / panning,
        and surfaces the relevant choices the moment they pick up the
        pencil. Shape pills are tinted amber so the "creation" zone is
        instantly distinguishable from the neutral view zone.
      */}
      <div className="flex items-center gap-1.5">
        <GroupLabel>Draw</GroupLabel>
        <button
          type="button"
          onClick={() => onToolChange('draw')}
          aria-pressed={drawActive}
          title="Draw tool (D) — sticky; press V to return to Select"
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold',
            drawActive
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-700 hover:bg-stone-100'
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Draw</span>
        </button>
        {drawActive ? (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Draw shape">
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
      </div>

      <div className="h-7 w-px bg-stone-200" aria-hidden />

      {/*
        Group 3 — EDIT / TRANSFORM.
        Operations that act on the *current selection*: clipboard
        (Ctrl+C / Ctrl+V), rotate ±15°, and the Auto-Arrange engine.
        Disabled states are driven off `hasSelection` /
        `clipboardHasContents` / `canAutoArrange` so it's obvious at
        a glance which actions are reachable.
      */}
      <div className="flex items-center gap-1.5">
        <GroupLabel>Edit</GroupLabel>
        <div className="flex items-center gap-1" role="group" aria-label="Edit selection">
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
          {/*
            Alignment pair — snaps selected centers to the median axis
            line of the selection. Requires at least two selected
            objects (one item is trivially "aligned with itself").
            The icons mirror the axis they snap to: vertical icon =
            stack-on-a-vertical-column, horizontal icon = line-up-on-
            a-horizontal-row.
          */}
          <button
            type="button"
            onClick={onAlignVertical}
            disabled={!canAlign}
            title="Align vertical centers (Shift+V) — stack selected objects on a single column"
            aria-label="Align selection vertical centers"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          >
            <AlignCenterVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onAlignHorizontal}
            disabled={!canAlign}
            title="Align horizontal centers (Shift+H) — line selected objects up on a single row"
            aria-label="Align selection horizontal centers"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          >
            <AlignCenterHorizontal className="h-3.5 w-3.5" />
          </button>
          {onAutoArrange ? (
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
          ) : null}
        </div>
      </div>

      {/*
        Group 4 — HISTORY + DESTRUCTIVE actions.
        Pinned to the right of the toolbar (`ml-auto`) so it sits in a
        consistent visual zone away from the *creation* zone on the
        left. Delete and Clear-all use rose tints to signal "this
        removes work" — separating them from the neutral undo/redo
        pair keeps the dangerous actions visually distinct.
      */}
      <div className="ml-auto flex items-center gap-1.5">
        <GroupLabel>History</GroupLabel>
        <div className="flex items-center gap-1" role="group" aria-label="History">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="h-7 w-px bg-stone-200" aria-hidden />
        <div className="flex items-center gap-1" role="group" aria-label="Destructive actions">
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            title={`Delete ${selectedCount} selected`}
            aria-label="Delete selection"
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            type="button"
            onClick={onClearAll}
            title="Clear canvas (no preset will be applied)"
            aria-label="Clear all objects"
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
}
