'use client'

import type { ObjectKind } from '../state/types'
import type { Rect } from '../interactions/geometry'

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
