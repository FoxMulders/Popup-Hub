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
}
