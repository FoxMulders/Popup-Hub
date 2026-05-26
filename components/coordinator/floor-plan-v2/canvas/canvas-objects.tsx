'use client'

import { memo } from 'react'
import type {
  AisleObject,
  BoothObject,
  DoorObject,
  LabelObject,
  PlacedObject,
  StageObject,
  WallObject,
} from '../state/types'

interface CanvasObjectsProps {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  pxPerFt: number
}

function fillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'booth':
      return obj.accentColor || '#fde68a'
    case 'wall':
      return '#1c1917'
    case 'aisle':
      return '#fafaf9'
    case 'stage':
      return '#fbcfe8'
    case 'door':
      return obj.doorType === 'entrance' ? '#22c55e' : '#ef4444'
    case 'label':
      return 'transparent'
  }
}

function strokeForObject(obj: PlacedObject, isSelected: boolean): string {
  if (isSelected) return '#0f766e'
  switch (obj.kind) {
    case 'booth':
      return '#78350f'
    case 'wall':
      return '#1c1917'
    case 'aisle':
      return '#a8a29e'
    case 'stage':
      return '#9d174d'
    case 'door':
      return obj.doorType === 'entrance' ? '#15803d' : '#b91c1c'
    case 'label':
      return '#57534e'
  }
}

function CanvasObjectsBase({
  objects,
  selectedIds,
  pxPerFt,
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
              strokeDasharray={obj.kind === 'aisle' ? '4 3' : undefined}
              pointerEvents="all"
              shapeRendering="crispEdges"
            />
            {labelText ? (
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
    case 'label':
      return ''
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1))}…`
}

export const CanvasObjects = memo(CanvasObjectsBase)
