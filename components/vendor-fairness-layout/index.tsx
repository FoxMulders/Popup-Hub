'use client'

import type { ReactNode } from 'react'
import type { BoothPlacement, Point } from '@/lib/vendor-fairness-layout/types'

export interface FloorPlanProps {
  boundary: Point[]
  placements: BoothPlacement[]
  boothSizes: Map<string, { width: number; height: number }>
  route?: Point[]
  heatmap?: Array<{ x: number; y: number; size: number; value: number }>
  fairnessScore?: number
  width?: number
  height?: number
  className?: string
  children?: ReactNode
}

function boundsFromBoundary(boundary: Point[]) {
  if (boundary.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 80 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of boundary) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function FloorPlan({
  boundary,
  placements,
  boothSizes,
  route,
  heatmap,
  fairnessScore,
  width = 800,
  height = 600,
  className,
  children,
}: FloorPlanProps) {
  const b = boundsFromBoundary(boundary)
  const pad = 5
  const viewBox = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Vendor fairness floor plan"
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon
        points={boundary.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth={0.5}
      />
      {heatmap && <FairnessHeatmap cells={heatmap} />}
      {route && route.length >= 2 && <RouteOverlay route={route} />}
      {placements.map((p) => {
        const size = boothSizes.get(p.boothId) ?? { width: 10, height: 8 }
        return (
          <Booth
            key={p.boothId}
            placement={p}
            width={size.width}
            height={size.height}
          />
        )
      })}
      {fairnessScore !== undefined && (
        <text x={b.minX} y={b.minY - 2} fontSize={3} fill="#0f172a">
          Fairness: {fairnessScore}
        </text>
      )}
      {children}
    </svg>
  )
}

export interface BoothProps {
  placement: BoothPlacement
  width: number
  height: number
}

export function Booth({ placement, width, height }: BoothProps) {
  const cx = placement.x + width / 2
  const cy = placement.y + height / 2
  const opacity = 0.4 + placement.exposureScore * 0.6
  const hue = Math.round((1 - placement.exposureScore) * 120)

  return (
    <g transform={`translate(${cx},${cy}) rotate(${placement.rotation}) translate(${-width / 2},${-height / 2})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={`hsla(${hue}, 70%, 45%, ${opacity})`}
        stroke="#1e293b"
        strokeWidth={0.25}
        rx={0.3}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.min(width, height) * 0.25}
        fill="#fff"
        pointerEvents="none"
      >
        {placement.boothId.slice(0, 6)}
      </text>
    </g>
  )
}

export interface RouteOverlayProps {
  route: Point[]
}

export function RouteOverlay({ route }: RouteOverlayProps) {
  const d = route.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke="#2563eb"
      strokeWidth={0.6}
      strokeDasharray="2 1"
      opacity={0.85}
    />
  )
}

export interface FairnessHeatmapProps {
  cells: Array<{ x: number; y: number; size: number; value: number }>
}

export function FairnessHeatmap({ cells }: FairnessHeatmapProps) {
  return (
    <g aria-hidden>
      {cells.map((c, i) => {
        const hue = Math.round((1 - c.value) * 120)
        return (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={c.size}
            height={c.size}
            fill={`hsla(${hue}, 60%, 50%, 0.15)`}
          />
        )
      })}
    </g>
  )
}
