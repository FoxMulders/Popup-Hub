'use client'

import { useId } from 'react'
import type { PatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import type { ShopperRouteMode } from '@/lib/shopper/pathfinding'

export interface PatronFlowOverlayProps {
  trace: PatronPathTrace
  cellPx: number
  canvasRows: number
  cols: number
  mode?: ShopperRouteMode
  className?: string
}

function smoothPathD(points: PatronPathTrace['points'], cellPx: number): string {
  if (points.length < 2) return ''
  const px = (col: number) => col * cellPx + cellPx / 2
  const py = (row: number) => row * cellPx + cellPx / 2

  let d = `M ${px(points[0].col)} ${py(points[0].row)}`
  if (points.length === 2) {
    d += ` L ${px(points[1].col)} ${py(points[1].row)}`
    return d
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const mx = (px(prev.col) + px(cur.col)) / 2
    const my = (py(prev.row) + py(cur.row)) / 2
    if (i === 1) {
      d += ` Q ${px(prev.col)} ${py(prev.row)} ${mx} ${my}`
    } else if (i < points.length - 1) {
      d += ` T ${mx} ${my}`
    } else {
      d += ` T ${px(cur.col)} ${py(cur.row)}`
    }
  }
  return d
}

const MODE_MARKERS: Record<ShopperRouteMode, { markerStart: string; markerEnd: string }> = {
  baseline: { markerStart: '#2563EB', markerEnd: '#7C3AED' },
  vendor: { markerStart: '#2563EB', markerEnd: '#059669' },
  exposition: { markerStart: '#2563EB', markerEnd: '#D97706' },
}

/** Smooth SVG route overlay for mobile floor plans. */
export function PatronFlowOverlay({
  trace,
  cellPx,
  canvasRows,
  cols,
  mode = 'baseline',
  className,
}: PatronFlowOverlayProps) {
  const uid = useId().replace(/:/g, '')
  if (trace.points.length < 2) return null

  const px = (col: number) => col * cellPx + cellPx / 2
  const py = (row: number) => row * cellPx + cellPx / 2
  const width = cols * cellPx
  const height = canvasRows * cellPx
  const pathD = smoothPathD(trace.points, cellPx)
  const markers = MODE_MARKERS[mode]
  const strokeWidth = Math.max(2.5, cellPx * 0.38)
  const dash =
    mode === 'baseline' ? '10 7' : mode === 'vendor' ? '6 4' : '8 5'

  return (
    <svg
      role="img"
      aria-label="Patron route overlay"
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width, height }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={`patron-gradient-baseline-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.88" />
        </linearGradient>
        <linearGradient id={`patron-gradient-vendor-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`patron-gradient-exposition-${uid}`} x1="0%" y1="100%" x2="100%" y2="20%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.92" />
          <stop offset="55%" stopColor="#0891B2" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <path
        d={pathD}
        fill="none"
        stroke={
          mode === 'baseline'
            ? `url(#patron-gradient-baseline-${uid})`
            : mode === 'vendor'
              ? `url(#patron-gradient-vendor-${uid})`
              : `url(#patron-gradient-exposition-${uid})`
        }
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.94}
        vectorEffect="non-scaling-stroke"
      />

      {mode === 'exposition' &&
        trace.stops?.map((stop) => {
          const x = px(stop.col)
          const y = py(stop.row)
          const r = cellPx * 0.55
          return (
            <g key={`patron-stop-${stop.order}`}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="#fff"
                stroke="#D97706"
                strokeWidth={1.5}
                opacity={0.95}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(7, cellPx * 0.42)}
                fontWeight={700}
                fill="#92400E"
              >
                {stop.order}
              </text>
            </g>
          )
        })}

      {trace.arrows.map((arrow, i) => {
        const x = px(arrow.col)
        const y = py(arrow.row)
        const size = cellPx * 0.42
        const angleDeg = (arrow.angle * 180) / Math.PI
        return (
          <polygon
            key={`patron-arrow-${i}`}
            points={`0,${-size} ${size * 1.35},0 0,${size}`}
            fill={mode === 'exposition' ? '#0891B2' : '#1D4ED8'}
            transform={`translate(${x} ${y}) rotate(${angleDeg})`}
            opacity={0.92}
          />
        )
      })}

      {trace.points[0] ? (
        <circle
          cx={px(trace.points[0].col)}
          cy={py(trace.points[0].row)}
          r={cellPx * 0.58}
          fill={markers.markerStart}
          stroke="#fff"
          strokeWidth={1.75}
        />
      ) : null}
      {trace.points.length > 1 ? (
        <circle
          cx={px(trace.points[trace.points.length - 1].col)}
          cy={py(trace.points[trace.points.length - 1].row)}
          r={cellPx * 0.52}
          fill={markers.markerEnd}
          stroke="#fff"
          strokeWidth={1.75}
        />
      ) : null}
    </svg>
  )
}
