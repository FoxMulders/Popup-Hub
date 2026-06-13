'use client'

import {
  editableRingForFrame,
  isAxisAlignedRect,
  openVertices,
} from '../geometry/polygon-edit'
import type { RoomFrame } from '../state/types'
import type { RoomResizeHandle } from '../state/room-canvas'

const HANDLE_RADIUS_PX = 6
const HANDLE_HIT_RADIUS_PX = 14
const VERTEX_HANDLE_RADIUS_PX = 6
const VERTEX_HANDLE_HIT_RADIUS_PX = 14
const STROKE = '#0f766e'

interface RoomSelectionOverlayProps {
  frame: RoomFrame
  pxPerFt: number
  suppressHandles?: boolean
  /** Hovered edge index from pointer hook (visual highlight only). */
  hoveredEdgeIndex?: number | null
}

const HANDLES: Array<{ id: RoomResizeHandle; cx: number; cy: number; cursor: string }> = [
  { id: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { id: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { id: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { id: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { id: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { id: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { id: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { id: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize' },
]

function ringToPathD(
  ring: ReadonlyArray<readonly [number, number]>,
  pxPerFt: number
): string {
  const verts = openVertices(ring)
  if (verts.length === 0) return ''
  const first = verts[0]!
  let d = `M ${first.x * pxPerFt} ${first.y * pxPerFt}`
  for (let i = 1; i < verts.length; i++) {
    const p = verts[i]!
    d += ` L ${p.x * pxPerFt} ${p.y * pxPerFt}`
  }
  return `${d} Z`
}

/**
 * Selection chrome for a selected room frame — dashed perimeter plus
 * eight rect resize handles OR vertex handles for non-rect polygons.
 * Pointer hook listens for `data-room-resize-handle` / `data-room-vertex-index`.
 */
export function RoomSelectionOverlay({
  frame,
  pxPerFt,
  suppressHandles = false,
  hoveredEdgeIndex = null,
}: RoomSelectionOverlayProps) {
  const ring = editableRingForFrame(frame)
  const selectionPath = ringToPathD(ring, pxPerFt)
  const useRectHandles =
    !suppressHandles &&
    !frame.joinGroupId &&
    !frame.mergedIntoObjectId &&
    isAxisAlignedRect(ring)
  const useVertexHandles =
    !suppressHandles && !frame.joinGroupId && !frame.mergedIntoObjectId && !useRectHandles

  const x = frame.originX * pxPerFt
  const y = frame.originY * pxPerFt
  const w = frame.widthFt * pxPerFt
  const h = frame.lengthFt * pxPerFt
  const verts = openVertices(ring)

  return (
    <g aria-hidden="true" className="canvas-overlay-layer">
      {selectionPath ? (
        <path
          d={selectionPath}
          fill="none"
          stroke={STROKE}
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      ) : (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={STROKE}
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {hoveredEdgeIndex != null && hoveredEdgeIndex >= 0 && verts.length >= 2 ? (
        (() => {
          const a = verts[hoveredEdgeIndex]!
          const b = verts[(hoveredEdgeIndex + 1) % verts.length]!
          return (
            <line
              x1={a.x * pxPerFt}
              y1={a.y * pxPerFt}
              x2={b.x * pxPerFt}
              y2={b.y * pxPerFt}
              stroke={STROKE}
              strokeWidth={4}
              strokeOpacity={0.45}
              pointerEvents="none"
            />
          )
        })()
      ) : null}

      {useRectHandles
        ? HANDLES.map((handle) => {
            const cx = x + w * handle.cx
            const cy = y + h * handle.cy
            return (
              <g key={handle.id} pointerEvents="all">
                <circle
                  cx={cx}
                  cy={cy}
                  r={HANDLE_HIT_RADIUS_PX}
                  fill="transparent"
                  data-room-resize-handle={handle.id}
                  data-room-id={frame.id}
                  style={{ cursor: handle.cursor, touchAction: 'none' }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={HANDLE_RADIUS_PX}
                  fill="#ffffff"
                  stroke={STROKE}
                  strokeWidth={2}
                  data-room-resize-handle={handle.id}
                  data-room-id={frame.id}
                  style={{ cursor: handle.cursor, touchAction: 'none' }}
                />
              </g>
            )
          })
        : null}

      {useVertexHandles
        ? verts.map((v, i) => {
            const cx = v.x * pxPerFt
            const cy = v.y * pxPerFt
            return (
              <g key={`vertex-${i}`} pointerEvents="all">
                <circle
                  cx={cx}
                  cy={cy}
                  r={VERTEX_HANDLE_HIT_RADIUS_PX}
                  fill="transparent"
                  data-room-vertex-index={i}
                  data-room-id={frame.id}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={VERTEX_HANDLE_RADIUS_PX}
                  fill="#ffffff"
                  stroke={STROKE}
                  strokeWidth={2}
                  data-room-vertex-index={i}
                  data-room-id={frame.id}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                />
              </g>
            )
          })
        : null}
    </g>
  )
}
