'use client'

import { memo } from 'react'
import type {
  AisleObject,
  BoothObject,
  DoorObject,
  EmergencyExitObject,
  LabelObject,
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
        const stroke = strokeForObject(obj, isSelected)
        const strokeWidth = isSelected ? 2.5 : 1.5
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
