'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ClipboardPaste,
  Combine,
  Copy,
  DoorOpen,
  Expand,
  Hand,
  LayoutGrid,
  Locate,
  Minimize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Siren,
  Split,
  Square,
  Tag,
  Trash2,
  Undo2,
  RectangleHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { DrawShape, ToolState } from './types'
import { CommandButton } from './command-button'
import { TableSizePill } from './table-size-pill'
import type { CanvasToolbarBlockId } from './toolbar-order'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'

const CREATION_SHAPES: Array<{
  id: DrawShape
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'floor' | 'arch' | 'destructive'
}> = [
  { id: 'booth', label: 'Booth', icon: Square, variant: 'floor' },
  { id: 'label', label: 'Label', icon: Tag, variant: 'floor' },
  { id: 'wall', label: 'Wall', icon: Square, variant: 'arch' },
  { id: 'open_wall', label: 'Open wall', icon: RectangleHorizontal, variant: 'arch' },
  { id: 'door', label: 'Door', icon: DoorOpen, variant: 'arch' },
  { id: 'emergency_exit', label: 'Exit', icon: Siren, variant: 'arch' },
  { id: 'stage', label: 'Stage', icon: Square, variant: 'arch' },
]

/**
 * Props for every toolbar block — pass through from `CanvasCommandBar`
 * so each block can call the same handlers you already wire today.
 */
export interface CanvasCommandBarBlockContext {
  toolState: ToolState
  onToolChange: (tool: ToolState['tool']) => void
  onDrawShapeChange: (shape: DrawShape) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCenterView: () => void
  onAlignVertical: () => void
  onAlignHorizontal: () => void
  selectedCount: number
  onCopy: () => void
  onPaste: () => void
  clipboardHasContents: boolean
  onRotateLeft: () => void
  onRotateRight: () => void
  onRotateRoomLeft?: () => void
  onRotateRoomRight?: () => void
  selectedRoomId?: string | null
  onAutoArrange?: () => void
  canAutoArrange?: boolean
  onJoinRooms?: () => void
  canJoinRooms?: boolean
  joinLabel: string
  joinTitle: string
  onUnjoinRoom?: () => void
  canUnjoinRoom?: boolean
  onClearAll: () => void
  onDeleteSelected: () => void
  tableSizeFt?: LayoutBaselineTableLengthFt
  onTableSizeChange?: (ft: LayoutBaselineTableLengthFt) => void
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  rooms?: LayoutRoom[]
  activeRoomId?: string
  onSelectRoom?: (roomId: string) => void
  onAddRoom?: (presetId?: import('@/lib/booth-planner/layout-room-presets').LayoutRoomPresetId) => void
  onRenameRoom?: (roomId: string, name: string) => void
  onDeleteRoom?: (roomId: string) => void
  highlightedRoomMetrics?: {
    name: string
    widthFt: number
    lengthFt: number
  } | null
  showLabels?: boolean
  onShowLabelsChange?: (show: boolean) => void
  canvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  autoArrangeMode?: AutoArrangeMode
  onAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
}

export function renderCanvasCommandBarBlock(
  id: CanvasToolbarBlockId,
  ctx: CanvasCommandBarBlockContext
): React.ReactNode {
  const hasSelection = ctx.selectedCount > 0
  const canAlign = ctx.selectedCount >= 2
  const rotateRoomId = ctx.selectedRoomId ?? ctx.activeRoomId ?? null
  const canRotateRoom = Boolean(rotateRoomId) && Boolean(ctx.onRotateRoomLeft)
  const rotateRoomHint = rotateRoomId
    ? 'Rotate the room and everything inside it 90°'
    : 'Select a room on the canvas (click its perimeter) to rotate'

  function activateDrawShape(shape: DrawShape) {
    ctx.onToolChange('draw')
    ctx.onDrawShapeChange(shape)
  }

  switch (id) {
    case 'primitives':
      return (
        <>
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Navigation tools"
          >
            <CommandButton
              onClick={() => ctx.onToolChange('select')}
              title="Select (V)"
              active={ctx.toolState.tool === 'select'}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={() => ctx.onToolChange('hand')}
              title="Hand (H)"
              active={ctx.toolState.tool === 'hand'}
            >
              <Hand className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
          <div
            className="mx-0.5 h-6 w-px bg-stone-200"
            aria-hidden
          />
          <div
            className="flex flex-wrap items-center gap-0.5"
            role="group"
            aria-label="Creation tools"
          >
            {CREATION_SHAPES.map((shape) => (
              <CommandButton
                key={shape.id}
                onClick={() => activateDrawShape(shape.id)}
                title={shape.label}
                label={shape.label}
                active={
                  ctx.toolState.tool === 'draw' &&
                  ctx.toolState.drawShape === shape.id
                }
                className={
                  shape.variant === 'floor'
                    ? ctx.toolState.tool === 'draw' &&
                      ctx.toolState.drawShape === shape.id
                      ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                      : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
                    : shape.variant === 'arch'
                      ? ctx.toolState.tool === 'draw' &&
                        ctx.toolState.drawShape === shape.id
                        ? 'bg-sky-200 text-sky-950 hover:bg-sky-200'
                        : 'text-stone-700 hover:bg-sky-50'
                      : undefined
                }
              >
                <shape.icon className="h-3.5 w-3.5" />
              </CommandButton>
            ))}
            <CommandButton
              onClick={ctx.onDeleteSelected}
              disabled={!hasSelection}
              title={`Delete ${ctx.selectedCount} selected`}
              label="Delete"
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onClearAll}
              title="Clear all objects in active room"
              label="Clear all"
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'history-clipboard':
      return (
        <>
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="History"
          >
            <CommandButton
              onClick={ctx.onUndo}
              disabled={!ctx.canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRedo}
              disabled={!ctx.canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
          <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Selection edit"
          >
            <CommandButton
              onClick={ctx.onCopy}
              disabled={!hasSelection}
              title="Copy selection (Ctrl+C)"
              label="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onPaste}
              disabled={!ctx.clipboardHasContents}
              title="Paste (Ctrl+V)"
              label="Paste"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateLeft}
              disabled={!hasSelection}
              title="Rotate -15°"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateRight}
              disabled={!hasSelection}
              title="Rotate selection +15°"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'room-transform':
      return ctx.onRotateRoomLeft && ctx.onRotateRoomRight ? (
        <div
          className="inline-flex items-center gap-0.5"
          role="group"
          aria-label="Rotate room"
        >
          <CommandButton
            onClick={ctx.onRotateRoomLeft}
            disabled={!canRotateRoom}
            title={canRotateRoom ? `${rotateRoomHint} (left)` : rotateRoomHint}
            label="Room ↺"
            className="text-teal-900 hover:bg-teal-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton
            onClick={ctx.onRotateRoomRight}
            disabled={!canRotateRoom}
            title={canRotateRoom ? `${rotateRoomHint} (right)` : rotateRoomHint}
            label="Room ↻"
            className="text-teal-900 hover:bg-teal-100"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </CommandButton>
        </div>
      ) : null

    case 'view-align':
      return (
        <>
          <CommandButton
            onClick={ctx.onCenterView}
            title="Center view on all placed objects"
            label="Center"
          >
            <Locate className="h-3.5 w-3.5" />
          </CommandButton>
          <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Alignment"
          >
            <CommandButton
              onClick={ctx.onAlignVertical}
              disabled={!canAlign}
              title="Align vertical centers (Shift+V)"
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onAlignHorizontal}
              disabled={!canAlign}
              title="Align horizontal centers (Shift+H)"
            >
              <AlignCenterHorizontal className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'arrangement':
      return (
        <>
          {ctx.onAutoArrange ? (
            <div
              className="inline-flex items-center gap-1"
              role="group"
              aria-label="Auto-arrange"
            >
              {ctx.onAutoArrangeModeChange ? (
                <select
                  value={ctx.autoArrangeMode ?? 'grid'}
                  onChange={(e) =>
                    ctx.onAutoArrangeModeChange!(
                      e.target.value as AutoArrangeMode
                    )
                  }
                  title="Auto-arrange placement mode"
                  aria-label="Auto-arrange mode"
                  className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700"
                >
                  <option value="grid">Grid</option>
                  <option value="staggered">Staggered</option>
                  <option value="perimeter-only">Perimeter</option>
                </select>
              ) : null}
              <CommandButton
                onClick={ctx.onAutoArrange}
                disabled={!ctx.canAutoArrange}
                title="Auto-arrange booths"
                label="Auto-Arrange"
                className="bg-amber-50 text-amber-900 hover:bg-amber-100"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </CommandButton>
            </div>
          ) : null}
          {ctx.onJoinRooms || ctx.onUnjoinRoom ? (
            <>
              {ctx.onAutoArrange ? (
                <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              ) : null}
              <div
                className="flex items-center gap-0.5"
                role="group"
                aria-label="Room joining"
              >
                {ctx.onJoinRooms ? (
                  <CommandButton
                    onClick={ctx.onJoinRooms}
                    disabled={!ctx.canJoinRooms}
                    title={ctx.joinTitle}
                    label={ctx.joinLabel}
                    className="bg-sky-50 text-sky-900 hover:bg-sky-100"
                  >
                    <Combine className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
                {ctx.onUnjoinRoom ? (
                  <CommandButton
                    onClick={ctx.onUnjoinRoom}
                    disabled={!ctx.canUnjoinRoom}
                    title="Split the active room out of its joined zone"
                    label="Unjoin"
                  >
                    <Split className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )

    case 'table-size':
      return ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
        <TableSizePill
          value={ctx.tableSizeFt}
          onChange={ctx.onTableSizeChange}
          className="shrink-0"
        />
      ) : null

    case 'rooms':
      return ctx.rooms?.length &&
        ctx.onSelectRoom &&
        ctx.onAddRoom &&
        ctx.onRenameRoom &&
        ctx.onDeleteRoom ? (
        <LayoutRoomBar
          rooms={ctx.rooms}
          activeRoomId={ctx.activeRoomId ?? ctx.rooms[0]!.id}
          onSelectRoom={ctx.onSelectRoom}
          onAddRoom={ctx.onAddRoom}
          onRenameRoom={ctx.onRenameRoom}
          onDeleteRoom={ctx.onDeleteRoom}
          highlightedRoomMetrics={ctx.highlightedRoomMetrics}
          embedded
        />
      ) : null

    case 'utilities':
      return (
        <>
          {ctx.onShowLabelsChange ? (
            <CommandButton
              onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
              title={
                ctx.showLabels
                  ? 'Hide architectural labels'
                  : 'Show architectural labels'
              }
              label="Show Labels"
              className={
                ctx.showLabels ? 'bg-sky-50 text-sky-900 hover:bg-sky-100' : undefined
              }
            >
              {ctx.showLabels ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}
          {ctx.onToggleCanvasFullscreen ? (
            <CommandButton
              onClick={ctx.onToggleCanvasFullscreen}
              title={
                ctx.canvasFullscreen
                  ? 'Exit full screen (Esc)'
                  : 'Full screen editor'
              }
              label={ctx.canvasFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className={
                ctx.canvasFullscreen
                  ? 'bg-stone-800 text-white hover:bg-stone-700'
                  : undefined
              }
            >
              {ctx.canvasFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}
          <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-stone-200">
            <button
              type="button"
              onClick={ctx.onZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={ctx.onZoomReset}
              title="Reset zoom to 100%"
              aria-label="Reset zoom"
              className="inline-flex h-full min-w-[3rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
            >
              {Math.round(ctx.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={ctx.onZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {ctx.onSaveMarket ? (
            <button
              type="button"
              onClick={ctx.onSaveMarket}
              disabled={ctx.saveMarketDisabled || ctx.saveMarketLoading}
              title="Save market and deploy"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {ctx.saveMarketLoading ? 'Saving…' : 'Save market'}
            </button>
          ) : null}
        </>
      )

    default:
      return null
  }
}

export function getVisibleToolbarBlockIds(ctx: {
  showTableSize: boolean
  showJoinGroup: boolean
  showRooms: boolean
  showArrangement: boolean
  showRoomTransform: boolean
}): CanvasToolbarBlockId[] {
  const ids: CanvasToolbarBlockId[] = [
    'primitives',
    'history-clipboard',
    'view-align',
  ]
  if (ctx.showRoomTransform) ids.push('room-transform')
  if (ctx.showArrangement) ids.push('arrangement')
  if (ctx.showTableSize) ids.push('table-size')
  if (ctx.showRooms) ids.push('rooms')
  ids.push('utilities')
  return ids
}
