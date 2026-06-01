'use client'

import type { RoomFrame } from '../state/types'
import type { RoomResizeHandle } from '../state/room-canvas'

const HANDLE_RADIUS_PX = 6
const HANDLE_HIT_RADIUS_PX = 14
const STROKE = '#0f766e'

interface RoomSelectionOverlayProps {
  frame: RoomFrame
  pxPerFt: number
  suppressHandles?: boolean
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

/**
 * Selection chrome for a selected room frame — dashed perimeter plus
 * eight resize handles (booth-style transform). Pointer hook listens
 * for `data-room-resize-handle`.
 */
export function RoomSelectionOverlay({
  frame,
  pxPerFt,
  suppressHandles = false,
}: RoomSelectionOverlayProps) {
  const x = frame.originX * pxPerFt
  const y = frame.originY * pxPerFt
  const w = frame.widthFt * pxPerFt
  const h = frame.lengthFt * pxPerFt

  return (
    <g aria-hidden="true" className="canvas-overlay-layer" pointerEvents="none">
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
      {suppressHandles
        ? null
        : HANDLES.map((handle) => {
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
          })}
    </g>
  )
}
