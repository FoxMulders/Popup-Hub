'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ClipboardPaste,
  Combine,
  Copy,
  Eye,
  EyeOff,
  Expand,
  LayoutGrid,
  Locate,
  Minimize2,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Split,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableSizePill } from './table-size-pill'
import type { CanvasToolHostProps } from './canvas-tool-types'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'

interface CanvasCommandBarProps extends CanvasToolHostProps {
  className?: string
  /** Inline room tabs + Add room (embedded in this ribbon). */
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
}

function CommandButton({
  onClick,
  disabled,
  title,
  label,
  children,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  label?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40',
        className
      )}
    >
      {children}
      {label ? <span className="hidden md:inline">{label}</span> : null}
    </button>
  )
}

/**
 * Global design strip — undo/redo, centering, alignment, clipboard,
 * and zoom live here so the left dock stays creation-focused.
 */
export function CanvasCommandBar({
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

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm',
        className
      )}
      role="toolbar"
      aria-label="Canvas command ribbon"
    >
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
        {onAutoArrange ? (
          <CommandButton
            onClick={onAutoArrange}
            disabled={!canAutoArrange}
            title="Auto-arrange booths"
            label="Auto-Arrange"
            className="bg-amber-50 text-amber-900 hover:bg-amber-100"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </CommandButton>
        ) : null}
      </div>

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

      <div className="ml-auto inline-flex items-center gap-2">
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
            label={canvasFullscreen ? 'Exit' : 'Full Screen'}
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
      </div>
    </div>
  )
}
