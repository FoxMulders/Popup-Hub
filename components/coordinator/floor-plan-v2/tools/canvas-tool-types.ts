import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { DrawShape, ToolId, ToolState } from './types'

export interface CanvasToolHostProps {
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
  onCopy: () => void
  onPaste: () => void
  clipboardHasContents: boolean
  onRotateLeft: () => void
  onRotateRight: () => void
  /** Rotate the selected room frame 90° (not individual objects). */
  onRotateRoomLeft?: () => void
  onRotateRoomRight?: () => void
  selectedRoomId?: string | null
  onAlignVertical: () => void
  onAlignHorizontal: () => void
  onDistributeVertical: () => void
  onDistributeHorizontal: () => void
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  onCenterView: () => void
  onAutoArrangeFloorPlan?: () => void
  canAutoArrangeFloorPlan?: boolean
  autoArrangeDisabledReason?: string | null
  autoArrangeMode?: AutoArrangeMode
  onAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  /** @deprecated Use unified floor-plan auto-arrange props */
  onVendorAutoArrange?: () => void
  canVendorAutoArrange?: boolean
  onPatronAutoArrange?: () => void
  canPatronAutoArrange?: boolean
  /**
   * Baseline table length (ft) for the active room — this is the
   * single venue-wide table size that drives newly-drawn booth
   * dimensions and gets persisted on the room. Hosts the toolbar
   * pill that used to live on Step 2; when the coordinator changes
   * the value here the canvas rescales any booth whose long edge
   * matches the previous baseline so the new size lands instantly
   * without a page reload. Optional — when both fields are omitted
   * the pill hides cleanly so non-Step-3 hosts stay unaffected.
   */
  tableSizeFt?: TableSizeSpec
  onTableSizeChange?: (selection: TableSizeSpec) => void
  /** Sets default booth footprint synchronously and switches to draw mode. */
  onPrepareTableDraw?: (selection: TableSizeSpec) => void
}
