'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CanvasToolHostProps } from './canvas-tool-types'
import { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import type { AddLayoutRoomOptions } from '@/lib/coordinator/add-layout-room'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { LayoutMode } from '@/lib/layout-strategies'
import {
  getVisibleToolbarBlockIds,
  renderCanvasCommandBarBlock,
  type CanvasCommandBarBlockContext,
} from './canvas-command-bar-blocks'
import { CanvasToolbarReorder } from './canvas-toolbar-reorder'
import { CanvasToolbarStatic } from './canvas-toolbar-static'
import type { DualScreenMode } from '@/lib/coordinator/floorplan-sync'
import {
  DASHBOARD_HEADER_SECTION_IDS,
  DASHBOARD_TOOLSTRIP_SECTION_IDS,
  getVisibleStaticToolbarRows,
} from './toolbar-static-layout'
import { ToolbarCompactProvider } from './command-button'

interface CanvasCommandBarProps extends CanvasToolHostProps {
  /** Fixed tool rows — no drag-reorder (command center). */
  staticLayout?: boolean
  /** Left-rail placement — vertical stack without canvas height cap. */
  sidebarLayout?: boolean
  /** Dashboard top strip — horizontal tool groups below the header. */
  topBarLayout?: boolean
  /** Dashboard header row — room/canvas controls beside Edit/Preview. */
  headerBarLayout?: boolean
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
  highlightedRoomId?: string | null
  onPatchRoomDimensions?: (
    roomId: string,
    patch: { widthFt: number; lengthFt: number }
  ) => void
  highlightedSelectionMetrics?: string | null
  showLabels?: boolean
  onShowLabelsChange?: (show: boolean) => void
  boothMapLabelMode?: import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
  onBoothMapLabelModeChange?: (
    mode: import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
  ) => void
  canvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  onLaunchDualScreen?: (mode: DualScreenMode) => void
  dualScreenActive?: boolean
  designerExitHref?: string | null
  designerExitLabel?: string
  onDesignerExit?: () => void
  vendorAutoArrangeMode?: AutoArrangeMode
  onVendorAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  patronAutoArrangeMode?: AutoArrangeMode
  onPatronAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  onAutoArrangeFloorPlan?: () => void
  canAutoArrangeFloorPlan?: boolean
  autoArrangeDisabledReason?: string | null
  autoArrangeRunning?: boolean
  lastAutoArrangeFeedback?: import('./canvas-command-bar-blocks').AutoArrangeFeedback | null
  autoArrangeMode?: AutoArrangeMode
  onAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  vendorLayoutMode?: LayoutMode
  onVendorLayoutModeChange?: (mode: LayoutMode) => void
  lastFairnessScore?: number | null
  lastFairnessCoverage?: number | null
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  saveDraftLoading?: boolean
  patronPathEnabled?: boolean
  onPatronPathToggle?: () => void
  showClearanceWarnings?: boolean
  onClearanceWarningsToggle?: () => void
  eventId?: string | null
  onRequestAiLayoutFeedback?: () => void
  canRequestAiLayoutFeedback?: boolean
  aiLayoutFeedbackLoading?: boolean
  vendorFillMaxCapacity?: number
  patronFillMaxCapacity?: number
  onFillVendorTables?: (count: number) => void
  onFillPatronTables?: (count: number) => void
  fillRoomDisabledReason?: string | null
}

/**
 * Unified top ribbon with fixed tool groups in default order.
 * Dashboard `staticLayout` uses stacked collapsible rows instead.
 * Drop handlers into `canvas-command-bar-blocks.tsx` per block id.
 */
export function CanvasCommandBar(props: CanvasCommandBarProps) {
  const {
    staticLayout = false,
    sidebarLayout = false,
    topBarLayout = false,
    headerBarLayout = false,
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
    onAutoArrangeFloorPlan,
    canAutoArrangeFloorPlan,
    autoArrangeDisabledReason,
    autoArrangeRunning,
    lastAutoArrangeFeedback,
    autoArrangeMode,
    onAutoArrangeModeChange,
    vendorLayoutMode,
    onVendorLayoutModeChange,
    lastFairnessScore,
    lastFairnessCoverage,
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
    highlightedRoomId,
    onPatchRoomDimensions,
    highlightedSelectionMetrics,
    showLabels = true,
    onShowLabelsChange,
    boothMapLabelMode,
    onBoothMapLabelModeChange,
    canvasFullscreen = false,
    onToggleCanvasFullscreen,
    onLaunchDualScreen,
    dualScreenActive = false,
    designerExitHref,
    designerExitLabel,
    onDesignerExit,
    vendorAutoArrangeMode = 'grid',
    onVendorAutoArrangeModeChange,
    patronAutoArrangeMode = 'grid',
    onPatronAutoArrangeModeChange,
    onSaveMarket,
    saveMarketDisabled,
    saveMarketLoading,
    onSaveDraft,
    saveDraftDisabled,
    saveDraftLoading,
    patronPathEnabled,
    onPatronPathToggle,
    showClearanceWarnings,
    onClearanceWarningsToggle,
    eventId,
    onRequestAiLayoutFeedback,
    canRequestAiLayoutFeedback,
    aiLayoutFeedbackLoading,
    vendorFillMaxCapacity,
    patronFillMaxCapacity,
    onFillVendorTables,
    onFillPatronTables,
    fillRoomDisabledReason,
  } = props

  const showTableSize = Boolean(onTableSizeChange) && tableSizeFt != null
  const showRooms =
    Boolean(onSelectRoom) &&
    Boolean(onAddRoom) &&
    Boolean(onRenameRoom) &&
    Boolean(onDeleteRoom)
  const needsRoomFirst = showRooms && (rooms?.length ?? 0) === 0
  const showRoomTransform = Boolean(onRotateRoomLeft) && Boolean(onRotateRoomRight)
  const showOptimize = Boolean(onAutoArrangeFloorPlan)
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
  const showRoom = showRooms || showRoomTransform

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
      onAutoArrangeFloorPlan,
      canAutoArrangeFloorPlan,
      autoArrangeDisabledReason,
      autoArrangeRunning,
      lastAutoArrangeFeedback,
      autoArrangeMode: autoArrangeMode ?? vendorAutoArrangeMode,
      onAutoArrangeModeChange:
        onAutoArrangeModeChange ?? onVendorAutoArrangeModeChange,
      vendorLayoutMode,
      onVendorLayoutModeChange,
      lastFairnessScore,
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
      highlightedRoomId,
      onPatchRoomDimensions,
      highlightedSelectionMetrics,
      showLabels,
      onShowLabelsChange,
      boothMapLabelMode,
      onBoothMapLabelModeChange,
      canvasFullscreen,
      onToggleCanvasFullscreen,
      onLaunchDualScreen,
      dualScreenActive,
      designerExitHref,
      designerExitLabel,
      onDesignerExit,
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
      onSaveDraft,
      saveDraftDisabled,
      saveDraftLoading,
      patronPathEnabled,
      onPatronPathToggle,
      showClearanceWarnings,
      onClearanceWarningsToggle,
      onRequestAiLayoutFeedback,
      canRequestAiLayoutFeedback,
      aiLayoutFeedbackLoading,
      vendorFillMaxCapacity,
      patronFillMaxCapacity,
      onFillVendorTables,
      onFillPatronTables,
      fillRoomDisabledReason,
      eventId,
      compact: true,
      sidebarLayout,
      topBarLayout: topBarLayout || headerBarLayout,
      headerBarLayout,
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
      onAutoArrangeFloorPlan,
      canAutoArrangeFloorPlan,
      autoArrangeDisabledReason,
      autoArrangeRunning,
      lastAutoArrangeFeedback,
      autoArrangeMode,
      onAutoArrangeModeChange,
      vendorLayoutMode,
      onVendorLayoutModeChange,
      lastFairnessScore,
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
      highlightedRoomId,
      onPatchRoomDimensions,
      highlightedSelectionMetrics,
      showLabels,
      onShowLabelsChange,
      boothMapLabelMode,
      onBoothMapLabelModeChange,
      canvasFullscreen,
      onToggleCanvasFullscreen,
      onLaunchDualScreen,
      dualScreenActive,
      designerExitHref,
      designerExitLabel,
      onDesignerExit,
      onSaveMarket,
      saveMarketDisabled,
      saveMarketLoading,
      onSaveDraft,
      saveDraftDisabled,
      saveDraftLoading,
      patronPathEnabled,
      onPatronPathToggle,
      showClearanceWarnings,
      onClearanceWarningsToggle,
      onRequestAiLayoutFeedback,
      canRequestAiLayoutFeedback,
      aiLayoutFeedbackLoading,
      vendorFillMaxCapacity,
      patronFillMaxCapacity,
      onFillVendorTables,
      onFillPatronTables,
      fillRoomDisabledReason,
      eventId,
      sidebarLayout,
      topBarLayout,
      headerBarLayout,
    ]
  )

  const visibleBlockIds = useMemo(
    () =>
      getVisibleToolbarBlockIds({
        needsRoomFirst,
        showVendor,
        showPatron,
        showRoom,
        showOptimize,
      }),
    [needsRoomFirst, showVendor, showPatron, showRoom, showOptimize]
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
          !staticLayout && !sidebarLayout && !topBarLayout && !headerBarLayout && 'flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto',
          !staticLayout &&
            !sidebarLayout &&
            !topBarLayout &&
            !headerBarLayout &&
            canvasFullscreen &&
            'max-h-[min(40vh,220px)] flex-wrap overflow-y-auto',
          staticLayout &&
            !sidebarLayout &&
            !topBarLayout &&
            !headerBarLayout &&
            'max-h-[min(36vh,180px)] overflow-x-auto overflow-y-auto',
          sidebarLayout &&
            'min-h-0 w-full shrink-0 overflow-y-auto overflow-x-hidden border-0 bg-transparent px-0 shadow-none',
          topBarLayout &&
            'w-full min-w-0 shrink-0 overflow-x-auto overflow-y-hidden border-0 bg-transparent px-0 shadow-none',
          headerBarLayout &&
            'w-full min-w-0 shrink-0 overflow-hidden border-0 bg-transparent px-0 shadow-none',
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
              topBarLayout={topBarLayout}
              headerBarLayout={headerBarLayout}
              sectionsFilter={
                topBarLayout
                  ? { includeOnly: DASHBOARD_TOOLSTRIP_SECTION_IDS }
                  : headerBarLayout
                    ? { includeOnly: DASHBOARD_HEADER_SECTION_IDS }
                    : undefined
              }
              eventId={eventId}
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
