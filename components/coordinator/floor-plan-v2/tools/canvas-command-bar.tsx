'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CanvasToolHostProps } from './canvas-tool-types'
import { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import {
  getVisibleToolbarBlockIds,
  renderCanvasCommandBarBlock,
  type CanvasCommandBarBlockContext,
} from './canvas-command-bar-blocks'
import { CanvasToolbarReorder } from './canvas-toolbar-reorder'

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

/**
 * Unified top ribbon with draggable tool groups (framer-motion Reorder).
 * Drop handlers into `canvas-command-bar-blocks.tsx` per block id.
 */
export function CanvasCommandBar(props: CanvasCommandBarProps) {
  const {
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
  } = props

  const showJoinGroup = Boolean(onJoinRooms) || Boolean(onUnjoinRoom)
  const showTableSize = Boolean(onTableSizeChange) && tableSizeFt != null
  const showRooms =
    Boolean(rooms?.length) &&
    Boolean(onSelectRoom) &&
    Boolean(onAddRoom) &&
    Boolean(onRenameRoom) &&
    Boolean(onDeleteRoom)
  const showArrangement = Boolean(onAutoArrange) || showJoinGroup
  const showRoomTransform = Boolean(onRotateRoomLeft) && Boolean(onRotateRoomRight)

  const joinLabel =
    canJoinRooms && joinCandidateCount && joinCandidateCount > 1
      ? `Join (${joinCandidateCount})`
      : 'Join'
  const joinTitle = canJoinRooms
    ? 'Extend the perimeter wall: dissolve shared edges with every overlapping/touching auxiliary room or joinable fixture (Stage)'
    : joinBlockedReason
      ? `Can't join: ${joinBlockedReason}`
      : 'Select an auxiliary room (Kitchen / Storage / Washroom / Annex) or a Stage to extend the perimeter'

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
        showTableSize,
        showJoinGroup,
        showRooms,
        showArrangement,
        showRoomTransform,
      }),
    [showTableSize, showJoinGroup, showRooms, showArrangement, showRoomTransform]
  )

  return (
    <div
      className={cn(
        'max-h-[min(42vh,320px)] overflow-y-auto rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm scrollbar-none',
        className
      )}
      role="toolbar"
      aria-label="Canvas command ribbon"
    >
      <CanvasToolbarReorder
        visibleBlockIds={visibleBlockIds}
        renderBlock={(id) => renderCanvasCommandBarBlock(id, blockContext)}
      />
    </div>
  )
}
