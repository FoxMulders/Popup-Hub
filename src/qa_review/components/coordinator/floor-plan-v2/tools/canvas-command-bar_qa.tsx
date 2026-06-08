'use client'

/**
 * QA dashboard command ribbon — portal tooltips + uppercase section headers.
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CanvasToolHostProps } from '@/components/coordinator/floor-plan-v2/tools/canvas-tool-types'
import { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { AddLayoutRoomOptions } from '@/lib/coordinator/add-layout-room'
import type { AutoArrangeMode } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  getVisibleToolbarBlockIds,
  renderCanvasCommandBarBlock,
  type CanvasCommandBarBlockContext,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-command-bar-blocks_qa'
import { CanvasToolbarReorder } from '@/components/coordinator/floor-plan-v2/tools/canvas-toolbar-reorder'
import { CanvasToolbarStaticQa as CanvasToolbarStatic } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-toolbar-static_qa'
import { getVisibleStaticToolbarRows } from '@/components/coordinator/floor-plan-v2/tools/toolbar-static-layout'
import { ToolbarCompactProvider } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/command-button_qa'
import {
  QA_TIP_CANT_MERGE,
  QA_TIP_MERGE,
  QA_TIP_MERGE_ROOMS,
  QA_TIP_MERGE_SHAPES,
  QA_TIP_SELECT_TO_MERGE,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/toolbar-tooltip-copy_qa'

interface CanvasCommandBarProps extends CanvasToolHostProps {
  /** Fixed tool rows — no drag-reorder (command center). */
  staticLayout?: boolean
  /** Left-rail placement — vertical stack without canvas height cap. */
  sidebarLayout?: boolean
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
  vendorAutoArrangeMode?: AutoArrangeMode
  onVendorAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  patronAutoArrangeMode?: AutoArrangeMode
  onPatronAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
}

/**
 * Unified top ribbon with draggable tool groups (framer-motion Reorder).
 * Dashboard `staticLayout` uses stacked collapsible rows instead.
 * Drop handlers into `canvas-command-bar-blocks.tsx` per block id.
 */
export function CanvasCommandBarQa(props: CanvasCommandBarProps) {
  const {
    staticLayout = false,
    sidebarLayout = false,
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
    onDistributeVertical,
    onDistributeHorizontal,
    selectedCount,
    onCopy,
    onPaste,
    clipboardHasContents,
    onRotateLeft,
    onRotateRight,
    onRotateRoomLeft,
    onRotateRoomRight,
    selectedRoomId,
    onVendorAutoArrange,
    canVendorAutoArrange,
    onPatronAutoArrange,
    canPatronAutoArrange,
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
    vendorAutoArrangeMode = 'grid',
    onVendorAutoArrangeModeChange,
    patronAutoArrangeMode = 'grid',
    onPatronAutoArrangeModeChange,
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
  const showRoomTransform = Boolean(onRotateRoomLeft) && Boolean(onRotateRoomRight)
  const showVendor =
    showTableSize ||
    Boolean(onVendorAutoArrange) ||
    Boolean(onPrepareTableDraw) ||
    Boolean(onTableSizeChange)
  const showPatron =
    showTableSize ||
    Boolean(onPatronAutoArrange) ||
    Boolean(onPrepareTableDraw) ||
    Boolean(onTableSizeChange)
  const showRoom = showRooms || showJoinGroup || showRoomTransform

  const joinLabel =
    canJoinRooms && joinCandidateCount && joinCandidateCount > 1
      ? `Merge (${joinCandidateCount})`
      : QA_TIP_MERGE
  const joinTitle = canJoinRooms
    ? mergePrefersShapes
      ? QA_TIP_MERGE_SHAPES
      : QA_TIP_MERGE_ROOMS
    : joinBlockedReason
      ? QA_TIP_CANT_MERGE
      : QA_TIP_SELECT_TO_MERGE

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
      onDistributeVertical,
      onDistributeHorizontal,
      selectedCount,
      onCopy,
      onPaste,
      clipboardHasContents,
      onRotateLeft,
      onRotateRight,
      onRotateRoomLeft,
      onRotateRoomRight,
      selectedRoomId,
      onVendorAutoArrange,
      canVendorAutoArrange,
      vendorAutoArrangeMode,
      onVendorAutoArrangeModeChange,
      onPatronAutoArrange,
      canPatronAutoArrange,
      patronAutoArrangeMode,
      onPatronAutoArrangeModeChange,
      onJoinRooms,
      canJoinRooms,
      joinLabel,
      joinTitle,
      joinBlockedReason,
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
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
      compact: true,
      sidebarLayout,
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
      onDistributeVertical,
      onDistributeHorizontal,
      selectedCount,
      onCopy,
      onPaste,
      clipboardHasContents,
      onRotateLeft,
      onRotateRight,
      onRotateRoomLeft,
      onRotateRoomRight,
      selectedRoomId,
      onVendorAutoArrange,
      canVendorAutoArrange,
      vendorAutoArrangeMode,
      onVendorAutoArrangeModeChange,
      onPatronAutoArrange,
      canPatronAutoArrange,
      patronAutoArrangeMode,
      onPatronAutoArrangeModeChange,
      onJoinRooms,
      canJoinRooms,
      joinLabel,
      joinTitle,
      joinBlockedReason,
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
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
      sidebarLayout,
    ]
  )

  const visibleBlockIds = useMemo(
    () =>
      getVisibleToolbarBlockIds({
        needsRoomFirst,
        showVendor,
        showPatron,
        showRoom,
      }),
    [needsRoomFirst, showVendor, showPatron, showRoom]
  )

  const visibleStaticRowIds = useMemo(
    () =>
      getVisibleStaticToolbarRows({
        needsRoomFirst,
        showVendor,
        showPatron,
        showRoom,
      }),
    [needsRoomFirst, showVendor, showPatron, showRoom]
  )

  const staticLayoutCtx = useMemo(
    () => ({
      needsRoomFirst,
      showRoom,
      showPatron,
      showVendor,
    }),
    [needsRoomFirst, showRoom, showPatron, showVendor]
  )

  return (
    <ToolbarCompactProvider compact={staticLayout}>
      <div
      className={cn(
        'shrink-0 rounded-lg border border-stone-200 bg-white px-1.5 shadow-sm',
        staticLayout ? 'py-0.5' : 'py-1',
        staticLayout &&
          !sidebarLayout &&
          'max-h-[min(36vh,180px)] overflow-x-auto overflow-y-auto',
        sidebarLayout &&
          'min-h-0 flex-1 overflow-visible border-0 bg-transparent px-0 shadow-none',
        className
      )}
        role="toolbar"
        aria-label="Canvas command ribbon"
      >
        {staticLayout ? (
          <CanvasToolbarStatic
            visibleRowIds={visibleStaticRowIds}
            compact
            layoutCtx={staticLayoutCtx}
            sidebarLayout={sidebarLayout}
            renderBlock={(id) => renderCanvasCommandBarBlock(id, blockContext)}
          />
        ) : (
          <CanvasToolbarReorder
            visibleBlockIds={visibleBlockIds}
            renderBlock={(id) => renderCanvasCommandBarBlock(id, blockContext)}
          />
        )}
      </div>
    </ToolbarCompactProvider>
  )
}
