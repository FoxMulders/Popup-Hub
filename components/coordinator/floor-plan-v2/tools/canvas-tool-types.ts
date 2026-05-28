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
   * Fuse the active room with every overlapping/touching neighbour
   * into a single dissolved zone (see `state/room-joins.ts`). Falsy
   * when fewer than two rooms touch — the button becomes disabled.
   */
  onJoinRooms?: () => void
  canJoinRooms?: boolean
  /** Number of frames eligible for the next join action — used as a
   *  badge on the button (e.g. "Join (3)"). */
  joinCandidateCount?: number
  /**
   * Split the active room out of its existing join group. Falsy
   * when the active room is not part of a group.
   */
  onUnjoinRoom?: () => void
  canUnjoinRoom?: boolean
}
