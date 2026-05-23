'use client'

import type { PatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import { SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'

export interface SvgPatronFlowLayerProps {
  trace: PatronPathTrace
  cellPx?: number
}

/** Dashed patron route from entrance to exit with directional chevrons. */
export function SvgPatronFlowLayer({ trace, cellPx = SVG_FOOT_PX }: SvgPatronFlowLayerProps) {
  if (trace.points.length < 2) return null

  const px = (col: number) => col * cellPx + cellPx / 2
  const py = (row: number) => row * cellPx + cellPx / 2

  const polyline = trace.points.map(({ row, col }) => `${px(col)},${py(row)}`).join(' ')

  return (
    <g aria-label="Patron flow path" pointerEvents="none">
      <polyline
        points={polyline}
        fill="none"
        stroke="#2563EB"
        strokeWidth={3}
        strokeDasharray="8 6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.92}
      />
      {trace.arrows.map((arrow, i) => {
        const x = px(arrow.col)
        const y = py(arrow.row)
        const size = cellPx * 0.35
        const angleDeg = (arrow.angle * 180) / Math.PI
        return (
          <polygon
            key={`patron-arrow-${i}`}
            points={`0,${-size} ${size * 1.4},0 0,${size}`}
            fill="#1D4ED8"
            transform={`translate(${x} ${y}) rotate(${angleDeg})`}
            opacity={0.95}
          />
        )
      })}
    </g>
  )
}
