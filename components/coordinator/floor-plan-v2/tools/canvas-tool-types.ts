import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
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
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  onCenterView: () => void
  onAutoArrange?: () => void
  canAutoArrange?: boolean
  /**
   * Fuse the active room (or a selected joinable fixture like a
   * Stage) with every overlapping/touching neighbour into a single
   * dissolved zone (see `state/room-joins.ts`).
   *
   * Asset-type gated: only enabled when the deliberate selection is
   * an auxiliary room (Kitchen / Storage / Washroom / Annex / etc.)
   * or a joinable `PlacedObject` (currently `stage`). Standard
   * vendor booths, walls, doors, and labels keep this falsy.
   */
  onJoinRooms?: () => void
  canJoinRooms?: boolean
  /** Number of participants (rooms + joinable fixtures) eligible
   *  for the next join action — used as a badge on the button. */
  joinCandidateCount?: number
  /**
   * Optional explanation surfaced as the join button's `title` when
   * the action is gated off (e.g. "booth can't extend the perimeter").
   * Lets coordinators understand why the button is dim instead of
   * staring at a silent disabled state.
   */
  joinBlockedReason?: string | null
  /** True when Merge will boolean-union selected shapes (walls, stages, …). */
  mergePrefersShapes?: boolean
  /**
   * Split the active room (or joined fixture) out of its existing
   * join group. Falsy when the active selection is not part of a
   * group.
   */
  onUnjoinRoom?: () => void
  canUnjoinRoom?: boolean
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
  tableSizeFt?: LayoutBaselineTableLengthFt
  onTableSizeChange?: (ft: LayoutBaselineTableLengthFt) => void
}
