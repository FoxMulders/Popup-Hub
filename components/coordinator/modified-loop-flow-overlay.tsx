'use client'

import { useMemo } from 'react'
import type { BoothCell, VenueElement } from '@/types/database'
import {
  computeModifiedLoopPatronPath,
  ENTRANCE_ORIENTATION_BUFFER_CELLS,
} from '@/lib/booth-planner/modified-loop-layout'
import { SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'

export interface ModifiedLoopFlowOverlayProps {
  cols: number
  rows: number
  hallOriginX?: number
  hallOriginY?: number
  cellPx?: number
  entrance: 'north' | 'south' | 'east' | 'west'
  venueElements: VenueElement[]
  placedCells?: BoothCell[]
  showBuffer?: boolean
  showPath?: boolean
}

/**
 * Interactive patron flow visualization for Modified Loop layouts.
 * Renders entrance buffer, serpentine path polyline, and direction arrows.
 */
export function ModifiedLoopFlowOverlay({
  cols,
  rows,
  hallOriginX = 0,
  hallOriginY = 0,
  cellPx = SVG_FOOT_PX,
  entrance,
  venueElements,
  placedCells = [],
  showBuffer = true,
  showPath = true,
}: ModifiedLoopFlowOverlayProps) {
  const { waypoints } = useMemo(
    () => computeModifiedLoopPatronPath(venueElements, cols, rows, entrance),
    [venueElements, cols, rows, entrance]
  )

  const entranceEl = venueElements.find((e) => e.type === 'entrance')
  const exitEl = venueElements.find((e) => e.type === 'exit')

  const bufferRect = useMemo(() => {
    if (!entranceEl || !showBuffer) return null
    const spanC = entranceEl.colSpan ?? 1
    const spanR = entranceEl.rowSpan ?? 1
    const pad = ENTRANCE_ORIENTATION_BUFFER_CELLS

    if (entrance === 'south') {
      const x = hallOriginX + (entranceEl.col - pad / 2) * cellPx
      const y = hallOriginY + (entranceEl.row + spanR - 1) * cellPx
      const w = (spanC + pad) * cellPx
      const h = pad * cellPx
      return { x, y, w, h }
    }
    if (entrance === 'north') {
      const x = hallOriginX + (entranceEl.col - pad / 2) * cellPx
      const y = hallOriginY + (entranceEl.row - pad) * cellPx
      const w = (spanC + pad) * cellPx
      const h = pad * cellPx
      return { x, y, w, h }
    }
    if (entrance === 'west') {
      const x = hallOriginX + (entranceEl.col + spanC - 1) * cellPx
      const y = hallOriginY
      const w = pad * cellPx
      const h = rows * cellPx
      return { x, y, w, h }
    }
    const x = hallOriginX + (entranceEl.col - pad) * cellPx
    const y = hallOriginY
    const w = pad * cellPx
    const h = rows * cellPx
    return { x, y, w, h }
  }, [entranceEl, entrance, showBuffer, hallOriginX, hallOriginY, cellPx, rows])

  const pathD = useMemo(() => {
    if (!showPath || waypoints.length < 2) return ''
    return waypoints
      .map((p, i) => {
        const x = hallOriginX + (p.col + 0.5) * cellPx
        const y = hallOriginY + (p.row + 0.5) * cellPx
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [waypoints, showPath, hallOriginX, hallOriginY, cellPx])

  const arrow = useMemo(() => {
    if (waypoints.length < 4) return null
    const mid = waypoints[Math.floor(waypoints.length / 3)]!
    const next = waypoints[Math.floor(waypoints.length / 3) + 1] ?? mid
    const x1 = hallOriginX + (mid.col + 0.5) * cellPx
    const y1 = hallOriginY + (mid.row + 0.5) * cellPx
    const x2 = hallOriginX + (next.col + 0.5) * cellPx
    const y2 = hallOriginY + (next.row + 0.5) * cellPx
    return { x1, y1, x2, y2 }
  }, [waypoints, hallOriginX, hallOriginY, cellPx])

  return (
    <g className="modified-loop-flow" aria-label="Patron flow overlay">
      {bufferRect ? (
        <rect
          x={bufferRect.x}
          y={bufferRect.y}
          width={bufferRect.w}
          height={bufferRect.h}
          fill="rgba(34, 197, 94, 0.08)"
          stroke="rgba(22, 101, 52, 0.35)"
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      ) : null}

      {pathD ? (
        <>
          <path
            d={pathD}
            fill="none"
            stroke="rgba(234, 88, 12, 0.85)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          {arrow ? (
            <line
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke="rgba(234, 88, 12, 0.9)"
              strokeWidth={4}
              markerEnd="url(#modified-loop-arrow)"
              pointerEvents="none"
            />
          ) : null}
        </>
      ) : null}

      {entranceEl ? (
        <text
          x={hallOriginX + (entranceEl.col + (entranceEl.colSpan ?? 1) / 2) * cellPx}
          y={hallOriginY + entranceEl.row * cellPx - 6}
          textAnchor="middle"
          className="fill-forest text-[10px] font-semibold"
          pointerEvents="none"
        >
          Entrance
        </text>
      ) : null}

      {exitEl ? (
        <text
          x={hallOriginX + (exitEl.col + (exitEl.colSpan ?? 1) / 2) * cellPx}
          y={hallOriginY + (exitEl.row + (exitEl.rowSpan ?? 1)) * cellPx + 14}
          textAnchor="middle"
          className="fill-harvest-700 text-[10px] font-semibold"
          pointerEvents="none"
        >
          Exit
        </text>
      ) : null}

      {placedCells
        .filter((c) => c.col >= 0)
        .map((cell) => (
          <circle
            key={cell.id}
            cx={hallOriginX + (cell.col + cell.colSpan / 2) * cellPx}
            cy={hallOriginY + (cell.row + cell.rowSpan / 2) * cellPx}
            r={3}
            fill={cell.categoryColor ?? '#64748b'}
            opacity={0.55}
            pointerEvents="none"
          />
        ))}

      <defs>
        <marker
          id="modified-loop-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(234, 88, 12, 0.9)" />
        </marker>
      </defs>
    </g>
  )
}
