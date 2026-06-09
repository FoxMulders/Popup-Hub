'use client'

import type { ObjectKind, PlacedObject } from '../state/types'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import { PLACEMENT_AVAILABLE, PLACEMENT_VIOLATION } from './placement-theme'

interface DraftPreviewProps {
  rect: Rect | null
  kind: ObjectKind | null
  pxPerFt: number
  /** When true, preview uses overlap warning styling. */
  hasOverlap?: boolean
  rotation?: number
  /** Semi-transparent cursor ghost before click. */
  ghost?: boolean
}

export function DraftPreview({
  rect,
  kind,
  pxPerFt,
  hasOverlap = false,
  rotation = 0,
  ghost = false,
}: DraftPreviewProps) {
  if (!rect || !kind) return null
  const x = rect.x * pxPerFt
  const y = rect.y * pxPerFt
  const w = Math.max(1, rect.width * pxPerFt)
  const h = Math.max(1, rect.height * pxPerFt)
  const cx = x + w / 2
  const cy = y + h / 2
  const isBoothPlacement = kind === 'booth'
  const isStagePlacement = kind === 'stage'
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
  const fillOpacity = ghost
    ? 0.4
    : hasOverlap
      ? PLACEMENT_VIOLATION.fillOpacity
      : isBoothPlacement
        ? PLACEMENT_AVAILABLE.fillOpacity
        : isStagePlacement
          ? 0
          : 0.35
  const shape = (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray={ghost ? '4 3' : '6 3'}
      pointerEvents="none"
    />
  )
  if (!rotation) return shape
  return (
    <g transform={`rotate(${rotation} ${cx} ${cy})`} pointerEvents="none">
      {shape}
    </g>
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
    case 'food_truck':
      return '#fed7aa'
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
    case 'food_truck':
      return '#c2410c'
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
  /** Hide the rotate handle while a different gesture is in flight. */
  suppressHandle?: boolean
}

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

function selectionItems(
  objects: ReadonlyArray<PlacedObject>,
  selectedIds: ReadonlySet<string>
): PlacedObject[] {
  if (selectedIds.size === 0) return []
  return objects.filter((o) => selectedIds.has(o.id))
}

/** Dashed AABB outline — non-interactive. */
export function SelectionChrome({
  objects,
  selectedIds,
  pxPerFt,
}: Omit<SelectionOverlayProps, 'suppressHandle'>) {
  const items = selectionItems(objects, selectedIds)
  if (items.length === 0) return null

  return (
    <g aria-hidden="true" className="canvas-selection-chrome" pointerEvents="none">
      {items.map((obj) => {
        const aabb = rotatedAabb(obj)
        const left = aabb.x * pxPerFt
        const top = aabb.y * pxPerFt
        const width = aabb.width * pxPerFt
        const height = aabb.height * pxPerFt
        return (
          <rect
            key={`sel-chrome-${obj.id}`}
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
        )
      })}
    </g>
  )
}

/**
 * Topmost interactive layer — rotate handles must sit above room chrome
 * and use an explicit `pointerEvents="auto"` root so clicks are not
 * swallowed by the grid or non-interactive overlay parents.
 */
export function SelectionRotateHandles({
  objects,
  selectedIds,
  pxPerFt,
  suppressHandle = false,
}: SelectionOverlayProps) {
  if (suppressHandle) return null
  const items = selectionItems(objects, selectedIds)
  if (items.length === 0) return null

  return (
    <g
      aria-hidden="true"
      className="canvas-rotate-handles"
      pointerEvents="auto"
      style={{ touchAction: 'none' }}
    >
      {items.map((obj) => {
        if (obj.locked) return null
        const aabb = rotatedAabb(obj)
        const left = aabb.x * pxPerFt
        const top = aabb.y * pxPerFt
        const width = aabb.width * pxPerFt
        const handleX = left + width / 2
        const handleY = top - ROTATE_HANDLE_OFFSET_PX
        return (
          <g key={`sel-rotate-${obj.id}`} pointerEvents="auto">
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
              stroke="#0f766e"
              strokeWidth={2}
              pointerEvents="all"
              data-rotate-handle="true"
              data-object-id={obj.id}
              style={{ cursor: 'grab', touchAction: 'none' }}
            />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Renders selection chrome for every selected object: a faint dotted
 * outline around the rotated AABB plus a single rotate handle on top
 * of each selection. The handle is what the pointer hook hooks into
 * via `data-rotate-handle="true"` + `data-object-id`.
 */
interface PatronTrafficPathProps {
  path: ReadonlyArray<{ x: number; y: number }> | null | undefined
  pxPerFt: number
}

/** Semi-transparent dotted polyline for computed patron traffic flow. */
export function PatronTrafficPathOverlay({
  path,
  pxPerFt,
}: PatronTrafficPathProps) {
  if (!path || path.length < 2) return null
  const d = path
    .map((p, i) => {
      const x = p.x * pxPerFt
      const y = p.y * pxPerFt
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke="#0284c7"
      strokeWidth={2.5}
      strokeOpacity={0.55}
      strokeDasharray="6 5"
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
      aria-hidden="true"
      className="patron-traffic-path"
    />
  )
}

export function SelectionOverlay({
  objects,
  selectedIds,
  pxPerFt,
  suppressHandle = false,
}: SelectionOverlayProps) {
  return (
    <>
      <SelectionChrome
        objects={objects}
        selectedIds={selectedIds}
        pxPerFt={pxPerFt}
      />
      <SelectionRotateHandles
        objects={objects}
        selectedIds={selectedIds}
        pxPerFt={pxPerFt}
        suppressHandle={suppressHandle}
      />
    </>
  )
}
