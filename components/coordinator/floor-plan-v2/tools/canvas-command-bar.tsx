'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CanvasToolHostProps } from './canvas-tool-types'
import { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { AddLayoutRoomOptions } from '@/lib/coordinator/add-layout-room'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import {
  getVisibleToolbarBlockIds,
  renderCanvasCommandBarBlock,
  type CanvasCommandBarBlockContext,
} from './canvas-command-bar-blocks'
import type { CanvasToolbarBlockId } from './toolbar-order'
import { CanvasToolbarReorder } from './canvas-toolbar-reorder'

interface CanvasCommandBarProps extends CanvasToolHostProps {
  /** Fixed tool rows — no drag-reorder (command center). */
  staticLayout?: boolean
  className?: string
  rooms?: LayoutRoom[]
  activeRoomId?: string
  onSelectRoom?: (roomId: string) => void
  onAddRoom?: (options?: AddLayoutRoomOptions) => void
  onRenameRoom?: (roomId: string, name: string) => void
  onDeleteRoom?: (roomId: string) => void
  highlightedRoomMetrics?: {
    name: string
    widthFt: number
    lengthFt: number
  } | null
  highlightedSelectionMetrics?: string | null
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

/**
 * Unified top ribbon with draggable tool groups (framer-motion Reorder).
 * Drop handlers into `canvas-command-bar-blocks.tsx` per block id.
 */
function CanvasToolbarStatic({
  visibleBlockIds,
  renderBlock,
}: {
  visibleBlockIds: readonly CanvasToolbarBlockId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {visibleBlockIds.map((id) => (
        <div
          key={id}
          className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-stone-200/90 bg-white px-1 py-0.5 shadow-sm"
        >
          {renderBlock(id)}
        </div>
      ))}
    </div>
  )
}

export function CanvasCommandBar(props: CanvasCommandBarProps) {
  const {
    staticLayout = false,
    className,
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
    onRotateRoomLeft,
    onRotateRoomRight,
    selectedRoomId,
    onAutoArrange,
    canAutoArrange,
    onJoinRooms,
    canJoinRooms,
    joinCandidateCount,
    joinBlockedReason,
    mergePrefersShapes,
    onUnjoinRoom,
    canUnjoinRoom,
    onClearAll,
    onDeleteSelected,
    tableSizeFt,
    onTableSizeChange,
    onPrepareTableDraw,
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
    highlightedSelectionMetrics,
    showLabels = true,
    onShowLabelsChange,
    canvasFullscreen = false,
    onToggleCanvasFullscreen,
    autoArrangeMode = 'grid',
    onAutoArrangeModeChange,
    onSaveMarket,
    saveMarketDisabled,
    saveMarketLoading,
  } = props

  const showJoinGroup = Boolean(onJoinRooms) || Boolean(onUnjoinRoom)
  const showTableSize = Boolean(onTableSizeChange) && tableSizeFt != null
  const showRooms =
    Boolean(onSelectRoom) &&
    Boolean(onAddRoom) &&
    Boolean(onRenameRoom) &&
    Boolean(onDeleteRoom)
  const needsRoomFirst = showRooms && (rooms?.length ?? 0) === 0
  const showArrangement = Boolean(onAutoArrange) || showJoinGroup
  const showRoomTransform = Boolean(onRotateRoomLeft) && Boolean(onRotateRoomRight)

  const joinLabel =
    canJoinRooms && joinCandidateCount && joinCandidateCount > 1
      ? `Merge (${joinCandidateCount})`
      : 'Merge'
  const joinTitle = canJoinRooms
    ? mergePrefersShapes
      ? 'Boolean union: fuse selected shapes into one path (interior edges removed)'
      : 'Dissolve shared walls between touching rooms into one outer perimeter'
    : joinBlockedReason
      ? `Can't merge: ${joinBlockedReason}`
      : 'Select 2+ shapes, or move rooms flush together, then Merge'

  const blockContext = useMemo<CanvasCommandBarBlockContext>(
    () => ({
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
      onRotateRoomLeft,
      onRotateRoomRight,
      selectedRoomId,
      onAutoArrange,
      canAutoArrange,
      onJoinRooms,
      canJoinRooms,
      joinLabel,
      joinTitle,
      onUnjoinRoom,
      canUnjoinRoom,
      onClearAll,
      onDeleteSelected,
      tableSizeFt,
      onTableSizeChange,
      onPrepareTableDraw,
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
      highlightedSelectionMetrics,
      showLabels,
      onShowLabelsChange,
      canvasFullscreen,
      onToggleCanvasFullscreen,
      autoArrangeMode,
      onAutoArrangeModeChange,
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
    }),
    [
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
      onRotateRoomLeft,
      onRotateRoomRight,
      selectedRoomId,
      onAutoArrange,
      canAutoArrange,
      onJoinRooms,
      canJoinRooms,
      joinLabel,
      joinTitle,
      onUnjoinRoom,
      canUnjoinRoom,
      onClearAll,
      onDeleteSelected,
      tableSizeFt,
      onTableSizeChange,
      onPrepareTableDraw,
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
      highlightedSelectionMetrics,
      showLabels,
      onShowLabelsChange,
      canvasFullscreen,
      onToggleCanvasFullscreen,
      autoArrangeMode,
      onAutoArrangeModeChange,
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
    ]
  )

  const visibleBlockIds = useMemo(
    () =>
      getVisibleToolbarBlockIds({
        needsRoomFirst,
        showTableSize,
        showJoinGroup,
        showRooms,
        showArrangement,
        showRoomTransform,
      }),
    [
      needsRoomFirst,
      showTableSize,
      showJoinGroup,
      showRooms,
      showArrangement,
      showRoomTransform,
    ]
  )

  return (
    <div
      className={cn(
        'shrink-0 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm',
        staticLayout && 'max-h-[min(42vh,220px)] overflow-x-auto overflow-y-auto',
        className
      )}
      role="toolbar"
      aria-label="Canvas command ribbon"
    >
      {staticLayout ? (
        <CanvasToolbarStatic
          visibleBlockIds={visibleBlockIds}
          renderBlock={(id) => renderCanvasCommandBarBlock(id, blockContext)}
        />
      ) : (
        <CanvasToolbarReorder
          visibleBlockIds={visibleBlockIds}
          renderBlock={(id) => renderCanvasCommandBarBlock(id, blockContext)}
        />
      )}
    </div>
  )
}
