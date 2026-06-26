'use client'

import type { ObjectKind, PlacedObject } from '../state/types'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import { PLACEMENT_AVAILABLE, PLACEMENT_VIOLATION } from './placement-theme'
import type { BoothClearanceTheme } from '@/lib/coordinator/booth-clearance-visual'
import {
  isHeatSourceObject,
  meltZoneRect,
  MELT_ZONE_THEME,
} from '@/lib/floor-plan/layout-guardrails/melt-zone-rules'

interface DraftPreviewProps {
  rect: Rect | null
  kind: ObjectKind | null
  pxPerFt: number
  /** When true, preview uses overlap warning styling. */
  hasOverlap?: boolean
  rotation?: number
  /** Semi-transparent cursor ghost before click. */
  ghost?: boolean
  /** Vendor booth clearance band colours (draw/hover preview). */
  clearanceTheme?: BoothClearanceTheme | null
}

export function DraftPreview({
  rect,
  kind,
  pxPerFt,
  hasOverlap = false,
  rotation = 0,
  ghost = false,
  clearanceTheme = null,
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
  const useClearanceBand =
    isBoothPlacement && !hasOverlap && clearanceTheme != null
  const stroke = hasOverlap
    ? PLACEMENT_VIOLATION.stroke
    : useClearanceBand
      ? clearanceTheme.stroke
      : isBoothPlacement
        ? PLACEMENT_AVAILABLE.stroke
        : previewStroke(kind)
  const fill = hasOverlap
    ? PLACEMENT_VIOLATION.fill
    : useClearanceBand
      ? clearanceTheme.fill
      : isBoothPlacement
        ? PLACEMENT_AVAILABLE.fill
        : previewFill(kind)
  const fillOpacity = ghost
    ? useClearanceBand
      ? Math.min(0.55, clearanceTheme.fillOpacity)
      : 0.4
    : hasOverlap
      ? PLACEMENT_VIOLATION.fillOpacity
      : useClearanceBand
        ? clearanceTheme.fillOpacity
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
      return '#bbf7d0'
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#fef3c7'
    case 'stage':
      return '#fbcfe8'
    case 'food_truck':
      return '#fed7aa'
    case 'food_court':
      return '#fef3c7'
    case 'amenity':
      return '#e0e7ff'
    case 'door':
      return '#22c55e'
    case 'emergency_exit':
      return '#fca5a5'
    case 'label':
      return 'transparent'
    case 'merged_zone':
      return '#ccfbf1'
  }
  return '#e7e5e4'
}

function previewStroke(kind: ObjectKind): string {
  switch (kind) {
    case 'booth':
      return '#16a34a'
    case 'wall':
      return '#0c0a09'
    case 'open_wall':
      return '#92400e'
    case 'stage':
      return '#9d174d'
    case 'food_truck':
      return '#c2410c'
    case 'food_court':
      return '#b45309'
    case 'amenity':
      return '#4338ca'
    case 'door':
      return '#15803d'
    case 'emergency_exit':
      return '#991b1b'
    case 'label':
      return '#57534e'
    case 'merged_zone':
      return '#0f766e'
  }
  return '#57534e'
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
  /** When set, each segment renders separately so failed legs never draw phantom chords. */
  pathSegments?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> | null
  pxPerFt: number
  isPartial?: boolean
}

/** Dashed polyline for computed patron traffic flow (non-interactive). */
export function PatronTrafficPathOverlay({
  path,
  pathSegments,
  pxPerFt,
  isPartial = false,
}: PatronTrafficPathProps) {
  const segments =
    pathSegments && pathSegments.length > 0
      ? pathSegments.filter((s) => s.length >= 2)
      : path && path.length >= 2
        ? [path]
        : []

  if (segments.length === 0) return null

  const stroke = isPartial ? '#ea580c' : '#0284c7'
  const dash = isPartial ? '4 6' : '6 4'

  return (
    <g aria-hidden="true" className="patron-traffic-path">
      {segments.map((segment, i) => {
        const points = segment
          .map((p) => `${p.x * pxPerFt},${p.y * pxPerFt}`)
          .join(' ')
        return (
          <polyline
            key={`patron-traffic-segment-${i}`}
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray={dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )
      })}
    </g>
  )
}

interface PatronAisleOverlayProps {
  corridors: ReadonlyArray<{
    x: number
    y: number
    width: number
    height: number
  }> | null | undefined
  pxPerFt: number
}

/** Semi-transparent 6′ patron aisle bands — grid circulation overlay. */
export function PatronAisleOverlay({ corridors, pxPerFt }: PatronAisleOverlayProps) {
  if (!corridors?.length) return null
  return (
    <g aria-label="Patron flow aisles" pointerEvents="none" className="patron-aisle-overlay">
      {corridors.map((rect, i) => (
        <rect
          key={`patron-aisle-${i}`}
          x={rect.x * pxPerFt}
          y={rect.y * pxPerFt}
          width={rect.width * pxPerFt}
          height={rect.height * pxPerFt}
          fill="#86efac"
          fillOpacity={0.28}
          stroke="#16a34a"
          strokeWidth={1}
          strokeDasharray="8 5"
          rx={2}
        />
      ))}
    </g>
  )
}

export interface UnifiedClearanceHeatCell {
  x: number
  y: number
  sizeFt: number
  band: 'critical' | 'tight' | 'good'
}

interface UnifiedLayoutFlowOverlayProps {
  spinePath: ReadonlyArray<{ x: number; y: number }> | null | undefined
  clearanceField: ReadonlyArray<UnifiedClearanceHeatCell> | null | undefined
  pxPerFt: number
}

const HEAT_FILL: Record<UnifiedClearanceHeatCell['band'], string> = {
  critical: '#fecaca',
  tight: '#fef08a',
  good: '#bbf7d0',
}

/** Unified solver spine polyline + clearance-band heat field. */
export function UnifiedLayoutFlowOverlay({
  spinePath,
  clearanceField,
  pxPerFt,
}: UnifiedLayoutFlowOverlayProps) {
  const hasHeat = Boolean(clearanceField?.length)
  const hasSpine = Boolean(spinePath && spinePath.length >= 2)
  if (!hasHeat && !hasSpine) return null

  const spinePoints = hasSpine
    ? spinePath!.map((p) => `${p.x * pxPerFt},${p.y * pxPerFt}`).join(' ')
    : ''

  return (
    <g
      aria-label="Unified layout patron spine and clearance heat"
      pointerEvents="none"
      className="unified-layout-flow-overlay"
    >
      {hasHeat
        ? clearanceField!.map((cell, i) => (
            <rect
              key={`unified-heat-${i}`}
              x={cell.x * pxPerFt}
              y={cell.y * pxPerFt}
              width={cell.sizeFt * pxPerFt}
              height={cell.sizeFt * pxPerFt}
              fill={HEAT_FILL[cell.band]}
              fillOpacity={0.22}
              stroke="none"
            />
          ))
        : null}
      {hasSpine ? (
        <polyline
          points={spinePoints}
          fill="none"
          stroke="#059669"
          strokeWidth={2.5}
          strokeDasharray="10 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        />
      ) : null}
    </g>
  )
}

export function MeltZoneHeatOverlay({
  objects,
  pxPerFt,
}: {
  objects: ReadonlyArray<PlacedObject>
  pxPerFt: number
}) {
  const zones = objects.filter(isHeatSourceObject).map((source) => meltZoneRect(source))

  if (zones.length === 0) return null

  return (
    <g aria-hidden="true" pointerEvents="none">
      {zones.map((zone, index) => (
        <rect
          key={`melt-zone-${index}`}
          x={zone.x * pxPerFt}
          y={zone.y * pxPerFt}
          width={zone.width * pxPerFt}
          height={zone.height * pxPerFt}
          fill={MELT_ZONE_THEME.fill}
          fillOpacity={0.18}
          stroke={MELT_ZONE_THEME.stroke}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      ))}
    </g>
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
