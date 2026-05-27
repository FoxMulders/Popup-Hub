'use client'

import type { ObjectKind, PlacedObject } from '../state/types'
import { rotatedAabb, type Rect } from '../interactions/geometry'

interface DraftPreviewProps {
  rect: Rect | null
  kind: ObjectKind | null
  pxPerFt: number
}

export function DraftPreview({ rect, kind, pxPerFt }: DraftPreviewProps) {
  if (!rect || !kind) return null
  const x = rect.x * pxPerFt
  const y = rect.y * pxPerFt
  const w = Math.max(1, rect.width * pxPerFt)
  const h = Math.max(1, rect.height * pxPerFt)
  const stroke = previewStroke(kind)
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={previewFill(kind)}
      fillOpacity={0.35}
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
    case 'aisle':
      return '#f5f5f4'
    case 'stage':
      return '#fbcfe8'
    case 'door':
      return '#22c55e'
    case 'label':
      return 'transparent'
  }
}

function previewStroke(kind: ObjectKind): string {
  switch (kind) {
    case 'booth':
      return '#a16207'
    case 'wall':
      return '#0c0a09'
    case 'aisle':
      return '#a8a29e'
    case 'stage':
      return '#9d174d'
    case 'door':
      return '#15803d'
    case 'label':
      return '#57534e'
  }
}

interface SelectionOverlayProps {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  pxPerFt: number
  /** Hide the rotate handle while a different gesture is in flight. */
  suppressHandle?: boolean
}

/**
 * Rotate handle in pixels. Sits above the rotated AABB top-center.
 * Tapping/dragging it kicks off a rotation gesture in the canvas
 * pointer hook (which looks up the handle by `data-rotate-handle`).
 */
const ROTATE_HANDLE_OFFSET_PX = 26
const ROTATE_HANDLE_RADIUS_PX = 7
const ROTATE_HANDLE_HIT_RADIUS_PX = 14

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
}: SelectionOverlayProps) {
  if (selectedIds.size === 0) return null
  const items = objects.filter((o) => selectedIds.has(o.id))
  if (items.length === 0) return null

  return (
    <g aria-hidden="true">
      {items.map((obj) => {
        const aabb = rotatedAabb(obj)
        const left = aabb.x * pxPerFt
        const top = aabb.y * pxPerFt
        const width = aabb.width * pxPerFt
        const height = aabb.height * pxPerFt
        const handleX = left + width / 2
        const handleY = top - ROTATE_HANDLE_OFFSET_PX
        const locked = !!obj.locked
        return (
          <g key={`sel-${obj.id}`}>
            {/* Bounding-box ghost — keeps users oriented when the
                object is rotated and its native rect would no longer
                hug the visible chrome. */}
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill="none"
              stroke="#0f766e"
              strokeWidth={1}
              strokeOpacity={0.55}
              strokeDasharray="4 3"
              pointerEvents="none"
              shapeRendering="crispEdges"
            />
            {locked || suppressHandle ? null : (
              <g>
                <line
                  x1={handleX}
                  y1={top}
                  x2={handleX}
                  y2={handleY}
                  stroke="#0f766e"
                  strokeWidth={1.25}
                  strokeDasharray="3 2"
                  pointerEvents="none"
                />
                {/* Invisible enlarged hit target so finger taps land
                    reliably on touch devices. */}
                <circle
                  cx={handleX}
                  cy={handleY}
                  r={ROTATE_HANDLE_HIT_RADIUS_PX}
                  fill="transparent"
                  data-rotate-handle="true"
                  data-object-id={obj.id}
                  style={{ cursor: 'grab' }}
                />
                <circle
                  cx={handleX}
                  cy={handleY}
                  r={ROTATE_HANDLE_RADIUS_PX}
                  fill="#ffffff"
                  stroke="#0f766e"
                  strokeWidth={2}
                  data-rotate-handle="true"
                  data-object-id={obj.id}
                  style={{ cursor: 'grab' }}
                />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
