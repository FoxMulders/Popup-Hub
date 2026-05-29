'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ClipboardPaste,
  Combine,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
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
  SquareDashed,
  Tag,
  Trash2,
  Undo2,
  RectangleHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableSizePill } from './table-size-pill'
import type { CanvasToolHostProps } from './canvas-tool-types'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { DrawShape } from './types'

interface CanvasCommandBarProps extends CanvasToolHostProps {
  className?: string
  rooms?: LayoutRoom[]
  activeRoomId?: string
  onSelectRoom?: (roomId: string) => void
  onAddRoom?: (presetId?: LayoutRoomPresetId) => void
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

function CommandButton({
  onClick,
  disabled,
  title,
  label,
  children,
  className,
  active,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  label?: string
  children: React.ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40',
        active && 'bg-stone-900 text-white hover:bg-stone-800',
        className
      )}
    >
      {children}
      {label ? <span className="hidden md:inline">{label}</span> : null}
    </button>
  )
}

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
 * Unified top ribbon — creation tools, history, alignment, auto-arrange,
 * rooms, zoom, and Save market.
 */
export function CanvasCommandBar({
  toolState,
  onToolChange,
  onDrawShapeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCenterView,
  onAlignVertical,
  onAlignHorizontal,
  selectedCount,
  onCopy,
  onPaste,
  clipboardHasContents,
  onRotateLeft,
  onRotateRight,
  onAutoArrange,
  canAutoArrange,
  onJoinRooms,
  canJoinRooms,
  joinCandidateCount,
  joinBlockedReason,
  onUnjoinRoom,
  canUnjoinRoom,
  onAddPerimeterWalls,
  onClearAll,
  onDeleteSelected,
  tableSizeFt,
  onTableSizeChange,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  highlightedRoomMetrics,
  showLabels = true,
  onShowLabelsChange,
  canvasFullscreen = false,
  onToggleCanvasFullscreen,
  autoArrangeMode = 'center-out',
  onAutoArrangeModeChange,
  onSaveMarket,
  saveMarketDisabled,
  saveMarketLoading,
  className,
}: CanvasCommandBarProps) {
  const hasSelection = selectedCount > 0
  const canAlign = selectedCount >= 2
  const showJoinGroup = Boolean(onJoinRooms) || Boolean(onUnjoinRoom)
  const showTableSize = Boolean(onTableSizeChange) && tableSizeFt != null
  const showRooms =
    Boolean(rooms?.length) &&
    Boolean(onSelectRoom) &&
    Boolean(onAddRoom) &&
    Boolean(onRenameRoom) &&
    Boolean(onDeleteRoom)
  const joinLabel =
    canJoinRooms && joinCandidateCount && joinCandidateCount > 1
      ? `Join (${joinCandidateCount})`
      : 'Join'
  const joinTitle = canJoinRooms
    ? 'Extend the perimeter wall: dissolve shared edges with every overlapping/touching auxiliary room or joinable fixture (Stage)'
    : joinBlockedReason
      ? `Can't join: ${joinBlockedReason}`
      : 'Select an auxiliary room (Kitchen / Storage / Washroom / Annex) or a Stage to extend the perimeter'

  function activateDrawShape(shape: DrawShape) {
    onToolChange('draw')
    onDrawShapeChange(shape)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm',
        className
      )}
      role="toolbar"
      aria-label="Canvas command ribbon"
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <div className="flex items-center gap-0.5" role="group" aria-label="Navigation tools">
          <CommandButton
            onClick={() => onToolChange('select')}
            title="Select (V)"
            active={toolState.tool === 'select'}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton
            onClick={() => onToolChange('hand')}
            title="Hand (H)"
            active={toolState.tool === 'hand'}
          >
            <Hand className="h-3.5 w-3.5" />
          </CommandButton>
        </div>

        <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />

        <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="Creation tools">
          {CREATION_SHAPES.map((shape) => (
            <CommandButton
              key={shape.id}
              onClick={() => activateDrawShape(shape.id)}
              title={shape.label}
              label={shape.label}
              active={toolState.tool === 'draw' && toolState.drawShape === shape.id}
              className={
                shape.variant === 'floor'
                  ? toolState.tool === 'draw' && toolState.drawShape === shape.id
                    ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                    : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
                  : shape.variant === 'arch'
                    ? toolState.tool === 'draw' && toolState.drawShape === shape.id
                      ? 'bg-sky-200 text-sky-950 hover:bg-sky-200'
                      : 'text-stone-700 hover:bg-sky-50'
                    : undefined
              }
            >
              <shape.icon className="h-3.5 w-3.5" />
            </CommandButton>
          ))}
          {onAddPerimeterWalls ? (
            <CommandButton
              onClick={onAddPerimeterWalls}
              title="Seal the active room with four locked perimeter walls"
              label="Add perimeter"
            >
              <SquareDashed className="h-3.5 w-3.5" />
            </CommandButton>
          ) : null}
          <CommandButton
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            title={`Delete ${selectedCount} selected`}
            label="Delete"
            className="text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton
            onClick={onClearAll}
            title="Clear all objects in active room"
            label="Clear all"
            className="text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </CommandButton>
        </div>

        <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />

        <div className="flex items-center gap-0.5" role="group" aria-label="History">
          <CommandButton onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="h-3.5 w-3.5" />
          </CommandButton>
        </div>

        <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />

        <CommandButton onClick={onCenterView} title="Center view on all placed objects" label="Center">
          <Locate className="h-3.5 w-3.5" />
        </CommandButton>

        <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />

        <div className="flex items-center gap-0.5" role="group" aria-label="Alignment">
          <CommandButton
            onClick={onAlignVertical}
            disabled={!canAlign}
            title="Align vertical centers (Shift+V)"
          >
            <AlignCenterVertical className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton
            onClick={onAlignHorizontal}
            disabled={!canAlign}
            title="Align horizontal centers (Shift+H)"
          >
            <AlignCenterHorizontal className="h-3.5 w-3.5" />
          </CommandButton>
        </div>

        <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />

        <div className="flex items-center gap-0.5" role="group" aria-label="Selection edit">
          <CommandButton onClick={onCopy} disabled={!hasSelection} title="Copy selection (Ctrl+C)" label="Copy">
            <Copy className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton
            onClick={onPaste}
            disabled={!clipboardHasContents}
            title="Paste (Ctrl+V)"
            label="Paste"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton onClick={onRotateLeft} disabled={!hasSelection} title="Rotate -15°">
            <RotateCcw className="h-3.5 w-3.5" />
          </CommandButton>
          <CommandButton onClick={onRotateRight} disabled={!hasSelection} title="Rotate +15°">
            <RotateCw className="h-3.5 w-3.5" />
          </CommandButton>
        </div>

        {onAutoArrange ? (
          <>
            <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
            <div className="inline-flex items-center gap-1" role="group" aria-label="Auto-arrange">
              {onAutoArrangeModeChange ? (
                <select
                  value={autoArrangeMode}
                  onChange={(e) =>
                    onAutoArrangeModeChange(e.target.value as AutoArrangeMode)
                  }
                  title="Auto-arrange placement mode"
                  aria-label="Auto-arrange mode"
                  className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700"
                >
                  <option value="center-out">Center-Out</option>
                  <option value="perimeter-only">Perimeter-Only</option>
                </select>
              ) : null}
              <CommandButton
                onClick={onAutoArrange}
                disabled={!canAutoArrange}
                title="Auto-arrange booths"
                label="Auto-Arrange"
                className="bg-amber-50 text-amber-900 hover:bg-amber-100"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </CommandButton>
            </div>
          </>
        ) : null}

        {showJoinGroup ? (
          <>
            <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
            <div className="flex items-center gap-0.5" role="group" aria-label="Room joining">
              {onJoinRooms ? (
                <CommandButton
                  onClick={onJoinRooms}
                  disabled={!canJoinRooms}
                  title={joinTitle}
                  label={joinLabel}
                  className="bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                >
                  <Combine className="h-3.5 w-3.5" />
                </CommandButton>
              ) : null}
              {onUnjoinRoom ? (
                <CommandButton
                  onClick={onUnjoinRoom}
                  disabled={!canUnjoinRoom}
                  title="Split the active room out of its joined zone"
                  label="Unjoin"
                >
                  <Split className="h-3.5 w-3.5" />
                </CommandButton>
              ) : null}
            </div>
          </>
        ) : null}

        {showRooms ? (
          <>
            <div className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
            <LayoutRoomBar
              rooms={rooms!}
              activeRoomId={activeRoomId ?? rooms![0]!.id}
              onSelectRoom={onSelectRoom!}
              onAddRoom={onAddRoom!}
              onRenameRoom={onRenameRoom!}
              onDeleteRoom={onDeleteRoom!}
              highlightedRoomMetrics={highlightedRoomMetrics}
              embedded
            />
          </>
        ) : null}

        <div className="ml-auto inline-flex flex-wrap items-center gap-2">
          {onShowLabelsChange ? (
            <CommandButton
              onClick={() => onShowLabelsChange(!showLabels)}
              title={
                showLabels
                  ? 'Hide architectural labels'
                  : 'Show architectural labels'
              }
              label="Show Labels"
              className={showLabels ? 'bg-sky-50 text-sky-900 hover:bg-sky-100' : undefined}
            >
              {showLabels ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}

          {onToggleCanvasFullscreen ? (
            <CommandButton
              onClick={onToggleCanvasFullscreen}
              title={canvasFullscreen ? 'Exit full screen (Esc)' : 'Full screen editor'}
              label={canvasFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className={
                canvasFullscreen
                  ? 'bg-stone-800 text-white hover:bg-stone-700'
                  : undefined
              }
            >
              {canvasFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}

          {showTableSize ? (
            <TableSizePill
              value={tableSizeFt!}
              onChange={onTableSizeChange!}
            />
          ) : null}

          <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-stone-200">
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
              aria-label="Reset zoom"
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

          {onSaveMarket ? (
            <button
              type="button"
              onClick={onSaveMarket}
              disabled={saveMarketDisabled || saveMarketLoading}
              title="Save market and deploy"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMarketLoading ? 'Saving…' : 'Save market'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
