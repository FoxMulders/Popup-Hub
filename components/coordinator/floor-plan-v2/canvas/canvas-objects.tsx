'use client'

import { memo } from 'react'
import type {
  AisleObject,
  BoothObject,
  DoorObject,
  EmergencyExitObject,
  LabelObject,
  OpenWallObject,
  PlacedObject,
  StageObject,
  WallObject,
} from '../state/types'
import { paletteForCategory, DEFAULT_BOOTH_PALETTE } from './category-palette'

interface CanvasObjectsProps {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  pxPerFt: number
  /**
   * Object whose label is currently being edited inline. The editing
   * input is rendered as a sibling overlay; we suppress the static
   * SVG label here so the two don't double up.
   */
  editingObjectId?: string | null
}

function fillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      // Explicit override wins; otherwise fall through to the deterministic
      // category palette so booths read by category color.
      if (booth.accentColor) return booth.accentColor
      return paletteForCategory(booth.categoryName).fill
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      // Pale travertine fill — visually softer than the solid wall
      // so the cutout reads as an opening rather than a closed
      // surface. The dashed counter line drawn on top provides the
      // "service window" cue.
      return '#fef3c7'
    case 'aisle':
      return '#fafaf9'
    case 'stage':
      return '#fbcfe8'
    case 'door':
      return obj.doorType === 'entrance' ? '#22c55e' : '#ef4444'
    case 'emergency_exit':
      return '#fca5a5'
    case 'label':
      return 'transparent'
  }
}

function strokeForObject(obj: PlacedObject, isSelected: boolean): string {
  if (isSelected) return '#0f766e'
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      // When the user has set a custom accentColor, keep the legacy
      // amber stroke so contrast stays readable. Otherwise pull the
      // stroke straight from the category palette.
      if (booth.accentColor) return DEFAULT_BOOTH_PALETTE.stroke
      return paletteForCategory(booth.categoryName).stroke
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#92400e'
    case 'aisle':
      return '#a8a29e'
    case 'stage':
      return '#9d174d'
    case 'door':
      return obj.doorType === 'entrance' ? '#15803d' : '#b91c1c'
    case 'emergency_exit':
      return '#991b1b'
    case 'label':
      return '#57534e'
  }
}

/** Default counter-depth (ft) when an open-wall doesn't specify one. */
const OPEN_WALL_DEFAULT_COUNTER_DEPTH_FT = 1.5

function CanvasObjectsBase({
  objects,
  selectedIds,
  pxPerFt,
  editingObjectId,
}: CanvasObjectsProps) {
  return (
    <g>
      {objects.map((obj) => {
        const x = obj.x * pxPerFt
        const y = obj.y * pxPerFt
        const w = obj.width * pxPerFt
        const h = obj.height * pxPerFt
        const isSelected = selectedIds.has(obj.id)
        const fill = fillForObject(obj)
        // When the object is part of an explicit join group its
        // perimeter is no longer "owned" by the object — the
        // dissolved zone polygon (rendered in <RoomFrames>) draws
        // the unified outer wall. Suppress the per-object stroke
        // so the two boundaries don't double up.
        const isJoined = !!obj.joinGroupId
        const stroke = isJoined && !isSelected
          ? 'transparent'
          : strokeForObject(obj, isSelected)
        const strokeWidth = isSelected ? 2.5 : isJoined ? 0 : 1.5
        const transform =
          obj.rotation && obj.rotation !== 0
            ? `rotate(${obj.rotation} ${x + w / 2} ${y + h / 2})`
            : undefined
        const labelText =
          obj.kind === 'label'
            ? (obj as LabelObject).text || obj.label || ''
            : obj.label || objectFallbackLabel(obj)
        const isEditing = editingObjectId === obj.id

        return (
          <g
            key={obj.id}
            transform={transform}
            data-object-id={obj.id}
            data-kind={obj.kind}
            data-locked={obj.locked ? 'true' : 'false'}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={fill}
              fillOpacity={obj.kind === 'aisle' ? 0.4 : 0.85}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={
                obj.kind === 'aisle'
                  ? '4 3'
                  : obj.kind === 'emergency_exit'
                    ? '6 3'
                    : undefined
              }
              pointerEvents="all"
              shapeRendering="crispEdges"
            />
            {/*
              Emergency-exit chevron — universal egress motif, drawn
              over the dashed-red rect so the fixture reads as
              fire-egress at any zoom level.
            */}
            {obj.kind === 'emergency_exit' ? (
              <polyline
                points={`${x + w * 0.25},${y + h * 0.5} ${x + w * 0.55},${y + h * 0.25} ${x + w * 0.55},${y + h * 0.75} ${x + w * 0.25},${y + h * 0.5}`}
                fill="#991b1b"
                stroke="#7f1d1d"
                strokeWidth={1}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ) : null}
            {/*
              Open-wall service window — the wall rectangle is
              already painted by the base <rect> above. Here we add:
                * a dashed inner cutout running along the LONG axis
                  of the wall (the "service line" patrons step up
                  to), insetting by the configured counter depth, and
                * two short tick marks at the ends of the cutout to
                  signal where the wall resumes.
              The cutout always tracks the wall's longer dimension
              so a 12'×1' counter shows the dashed line horizontally
              and a 1'×8' window shows it vertically without the
              coordinator having to flip orientation by hand.
            */}
            {obj.kind === 'open_wall' ? (
              (() => {
                const ow = obj as OpenWallObject
                const counterDepthFt =
                  ow.counterDepthFt && ow.counterDepthFt > 0
                    ? ow.counterDepthFt
                    : OPEN_WALL_DEFAULT_COUNTER_DEPTH_FT
                const counterDepthPx = counterDepthFt * pxPerFt
                const isLandscape = w >= h
                // Inset the cutout by counterDepth along the SHORT
                // axis, and pad ~10% along the LONG axis so the
                // service line doesn't run wall-to-wall.
                const longPad = (isLandscape ? w : h) * 0.1
                const shortInset = Math.min(
                  isLandscape ? h - 1 : w - 1,
                  Math.max(0.3 * pxPerFt, counterDepthPx)
                )
                const cutX1 = isLandscape ? x + longPad : x + shortInset
                const cutX2 = isLandscape ? x + w - longPad : x + shortInset
                const cutY1 = isLandscape ? y + shortInset : y + longPad
                const cutY2 = isLandscape ? y + shortInset : y + h - longPad
                return (
                  <g pointerEvents="none">
                    {/* Service-counter line (the open portion). */}
                    <line
                      x1={cutX1}
                      y1={cutY1}
                      x2={cutX2}
                      y2={cutY2}
                      stroke="#92400e"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      strokeLinecap="round"
                    />
                    {/* End-cap ticks marking where the wall resumes. */}
                    <line
                      x1={isLandscape ? cutX1 : cutX1 - 4}
                      y1={isLandscape ? cutY1 - 4 : cutY1}
                      x2={isLandscape ? cutX1 : cutX1 + 4}
                      y2={isLandscape ? cutY1 + 4 : cutY1}
                      stroke="#92400e"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={isLandscape ? cutX2 : cutX2 - 4}
                      y1={isLandscape ? cutY2 - 4 : cutY2}
                      x2={isLandscape ? cutX2 : cutX2 + 4}
                      y2={isLandscape ? cutY2 + 4 : cutY2}
                      stroke="#92400e"
                      strokeWidth={1.5}
                    />
                  </g>
                )
              })()
            ) : null}
            {labelText && !isEditing ? (
              <text
                x={x + w / 2}
                y={y + h / 2 + 4}
                textAnchor="middle"
                fontSize={Math.min(14, Math.max(8, w * 0.18))}
                fontWeight={700}
                fill={textFillForObject(obj)}
                pointerEvents="none"
              >
                {truncate(labelText, 18)}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

function textFillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#fafaf9'
    case 'open_wall':
      return '#92400e'
    case 'aisle':
      return '#57534e'
    case 'door':
      return '#fafaf9'
    case 'emergency_exit':
      return '#7f1d1d'
    default:
      return '#1c1917'
  }
}

function objectFallbackLabel(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'booth':
      return (obj as BoothObject).vendorId ? '' : 'Booth'
    case 'wall':
      return (obj as WallObject).label || ''
    case 'open_wall':
      return (obj as OpenWallObject).label || 'Open wall'
    case 'aisle':
      return (obj as AisleObject).label || 'Aisle'
    case 'stage':
      return (obj as StageObject).label || 'Stage'
    case 'door':
      return (obj as DoorObject).doorType === 'entrance' ? 'IN' : 'OUT'
    case 'emergency_exit':
      return (obj as EmergencyExitObject).label || 'EXIT'
    case 'label':
      return ''
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1))}…`
}

export const CanvasObjects = memo(CanvasObjectsBase)
