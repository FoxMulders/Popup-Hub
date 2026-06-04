'use client'

import type { ObjectKind, PlacedObject } from '../state/types'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import {
  formatObjectDimensions,
  OBJECT_RESIZE_HANDLES,
  objectHandleWorldPosition,
  objectSupportsCanvasResize,
} from '../interactions/object-resize'
import { PLACEMENT_AVAILABLE, PLACEMENT_VIOLATION } from './placement-theme'

interface DraftPreviewProps {
  rect: Rect | null
  kind: ObjectKind | null
  pxPerFt: number
  /** When true, preview uses overlap warning styling. */
  hasOverlap?: boolean
}

export function DraftPreview({
  rect,
  kind,
  pxPerFt,
  hasOverlap = false,
}: DraftPreviewProps) {
  if (!rect || !kind) return null
  const x = rect.x * pxPerFt
  const y = rect.y * pxPerFt
  const w = Math.max(1, rect.width * pxPerFt)
  const h = Math.max(1, rect.height * pxPerFt)
  const isBoothPlacement = kind === 'booth'
  const stroke = hasOverlap
    ? PLACEMENT_VIOLATION.stroke
    : isBoothPlacement
      ? PLACEMENT_AVAILABLE.stroke
      : previewStroke(kind)
  const fill = hasOverlap
    ? PLACEMENT_VIOLATION.fill
    : isBoothPlacement
      ? PLACEMENT_AVAILABLE.fill
      : previewFill(kind)
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={fill}
      fillOpacity={
        hasOverlap
          ? PLACEMENT_VIOLATION.fillOpacity
          : isBoothPlacement
            ? PLACEMENT_AVAILABLE.fillOpacity
            : 0.35
      }
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray="6 3"
      pointerEvents="none"
    />
  )
}

interface MarqueeProps {
  rect: Rect | null
  pxPerFt: number
}

export function MarqueePreview({ rect, pxPerFt }: MarqueeProps) {
  if (!rect) return null
  const x = rect.x * pxPerFt
  const y = rect.y * pxPerFt
  const w = rect.width * pxPerFt
  const h = rect.height * pxPerFt
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="#0ea5e9"
      fillOpacity={0.08}
      stroke="#0284c7"
      strokeWidth={1.25}
      strokeDasharray="4 2"
      pointerEvents="none"
    />
  )
}

function previewFill(kind: ObjectKind): string {
  switch (kind) {
    case 'booth':
      return '#fde68a'
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#fef3c7'
    case 'stage':
      return '#fbcfe8'
    case 'door':
      return '#22c55e'
    case 'emergency_exit':
      return '#fca5a5'
    case 'label':
      return 'transparent'
    case 'merged_zone':
      return '#ccfbf1'
  }
}

function previewStroke(kind: ObjectKind): string {
  switch (kind) {
    case 'booth':
      return '#a16207'
    case 'wall':
      return '#0c0a09'
    case 'open_wall':
      return '#92400e'
    case 'stage':
      return '#9d174d'
    case 'door':
      return '#15803d'
    case 'emergency_exit':
      return '#991b1b'
    case 'label':
      return '#57534e'
    case 'merged_zone':
      return '#0f766e'
  }
}

interface SelectionOverlayProps {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  pxPerFt: number
  /** Hide interactive handles while a different gesture is in flight. */
  suppressHandle?: boolean
  /** Outline only (below room chrome) vs handles/labels (above room chrome). */
  layer?: 'outline' | 'controls'
}

const RESIZE_HANDLE_RADIUS_PX = 5
const RESIZE_HANDLE_HIT_RADIUS_PX = 14
const STROKE = '#0f766e'

/**
 * Rotate handle in pixels. Sits above the rotated AABB top-center.
 * Tapping/dragging it kicks off a rotation gesture in the canvas
 * pointer hook (which looks up the handle by `data-rotate-handle`).
 *
 * The hit target follows Apple's HIG: 44pt minimum touch area, so the
 * invisible hit circle is 22px radius (44px diameter) while the
 * visible chrome stays compact at 7px radius.
 */
const ROTATE_HANDLE_OFFSET_PX = 30
const ROTATE_HANDLE_RADIUS_PX = 7
const ROTATE_HANDLE_HIT_RADIUS_PX = 22

/**
 * Renders selection chrome for every selected object: a faint dotted
 * outline around the rotated AABB plus a single rotate handle on top
 * of each selection. The handle is what the pointer hook hooks into
 * via `data-rotate-handle="true"` + `data-object-id`.
 */
export function SelectionOverlay({
  objects,
  selectedIds,
  pxPerFt,
  suppressHandle = false,
  layer = 'controls',
}: SelectionOverlayProps) {
  if (selectedIds.size === 0) return null
  const items = objects.filter((o) => selectedIds.has(o.id))
  if (items.length === 0) return null

  if (layer === 'outline') {
    return (
      <g aria-hidden="true" className="canvas-overlay-layer" pointerEvents="none">
        {items.map((obj) => {
          const aabb = rotatedAabb(obj)
          const left = aabb.x * pxPerFt
          const top = aabb.y * pxPerFt
          const width = aabb.width * pxPerFt
          const height = aabb.height * pxPerFt
          return (
            <rect
              key={`sel-outline-${obj.id}`}
              x={left}
              y={top}
              width={width}
              height={height}
              fill="none"
              stroke={STROKE}
              strokeWidth={1}
              strokeOpacity={0.55}
              strokeDasharray="4 3"
              pointerEvents="none"
              shapeRendering="crispEdges"
            />
          )
        })}
      </g>
    )
  }

  return (
    <g aria-hidden="true" className="canvas-overlay-layer" pointerEvents="none">
      {items.map((obj) => {
        const aabb = rotatedAabb(obj)
        const left = aabb.x * pxPerFt
        const top = aabb.y * pxPerFt
        const width = aabb.width * pxPerFt
        const height = aabb.height * pxPerFt
        const handleX = left + width / 2
        const handleY = top - ROTATE_HANDLE_OFFSET_PX
        const locked = !!obj.locked
        const canResize =
          !locked && !suppressHandle && objectSupportsCanvasResize(obj)
        const showRotate = !locked && !suppressHandle
        const label = formatObjectDimensions(obj)
        const labelY = top + height + 14
        return (
          <g key={`sel-${obj.id}`}>
            {canResize
              ? OBJECT_RESIZE_HANDLES.map((handle) => {
                  const world = objectHandleWorldPosition(obj, handle.id)
                  const cx = world.x * pxPerFt
                  const cy = world.y * pxPerFt
                  return (
                    <g key={`${obj.id}-${handle.id}`} pointerEvents="all">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={RESIZE_HANDLE_HIT_RADIUS_PX}
                        fill="transparent"
                        data-object-resize-handle={handle.id}
                        data-object-id={obj.id}
                        style={{ cursor: handle.cursor, touchAction: 'none' }}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={RESIZE_HANDLE_RADIUS_PX}
                        fill="#ffffff"
                        stroke={STROKE}
                        strokeWidth={2}
                        data-object-resize-handle={handle.id}
                        data-object-id={obj.id}
                        style={{ cursor: handle.cursor, touchAction: 'none' }}
                      />
                    </g>
                  )
                })
              : null}
            <text
              x={handleX}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#0f766e"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {label}
            </text>
            {showRotate ? (
              <g>
                <line
                  x1={handleX}
                  y1={top}
                  x2={handleX}
                  y2={handleY}
                  stroke={STROKE}
                  strokeWidth={1.25}
                  strokeDasharray="3 2"
                  pointerEvents="none"
                />
                <circle
                  cx={handleX}
                  cy={handleY}
                  r={ROTATE_HANDLE_HIT_RADIUS_PX}
                  fill="transparent"
                  pointerEvents="all"
                  data-rotate-handle="true"
                  data-object-id={obj.id}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                />
                <circle
                  cx={handleX}
                  cy={handleY}
                  r={ROTATE_HANDLE_RADIUS_PX}
                  fill="#ffffff"
                  stroke={STROKE}
                  strokeWidth={2}
                  data-rotate-handle="true"
                  data-object-id={obj.id}
                  style={{ cursor: 'grab' }}
                />
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
