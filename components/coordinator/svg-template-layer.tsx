'use client'

import type { ReactElement } from 'react'
import type { VenueElement } from '@/types/database'
import { SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'
import { fixtureCanvasLabel, isElementOrigin } from '@/lib/booth-planner/venue-elements'
import { isPerimeterWallElement } from '@/lib/booth-planner/perimeter-wall-segments'

const FIXTURE_FILL: Record<string, string> = {
  entrance: '#DDE8DD',
  exit: '#F5E6E0',
  door: '#FDF0D5',
  aisle: '#FAFAF9',
  restroom: '#E7E5E4',
  food_court: '#FEF3C7',
  seating: '#F5F2EB',
  stage: '#E7E5E4',
  column: '#78716C',
  custom_label: '#FFFFFF',
}

export interface SvgTemplateLayerProps {
  rows: number
  cols: number
  /** Hall interior row count — perimeter walls use this, not extended annex rows. */
  hallRows?: number
  cellPx?: number
  venueMap: Map<string, VenueElement>
}

/** Non-interactive locked template layer — perimeter walls and locked structural zones. */
export function SvgTemplateLayer({
  rows,
  cols,
  hallRows = rows,
  cellPx = SVG_FOOT_PX,
  venueMap,
}: SvgTemplateLayerProps) {
  const rendered = new Set<string>()
  const elements: ReactElement[] = []
  const px = (col: number) => col * cellPx
  const py = (row: number) => row * cellPx

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`
      if (rendered.has(key)) continue

      const fixture = venueMap.get(key)
      if (!fixture || !isElementOrigin(fixture, r, c)) continue
      if (fixture.type === 'entrance' || fixture.type === 'exit' || fixture.type === 'door') continue
      if (fixture.type === 'stage') continue
      if (!fixture.locked && !isPerimeterWallElement(fixture, cols, hallRows)) continue

      const spanC = fixture.colSpan ?? 1
      const spanR = fixture.rowSpan ?? 1
      for (let dr = 0; dr < spanR; dr++) {
        for (let dc = 0; dc < spanC; dc++) {
          rendered.add(`${r + dr}-${c + dc}`)
        }
      }

      const isPerimeterWall = isPerimeterWallElement(fixture, cols, hallRows)
      const isWalkway = fixture.type === 'aisle'
      const w = spanC * cellPx
      const h = spanR * cellPx
      const x = px(c)
      const y = py(r)
      const label = fixtureCanvasLabel(fixture, cols, hallRows)

      elements.push(
        <g key={`template-${fixture.id}`} aria-hidden={isPerimeterWall}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={isPerimeterWall ? '#78716C' : FIXTURE_FILL[fixture.type] ?? '#E8E4DC'}
            stroke="#000000"
            strokeWidth={2.5}
            strokeDasharray={isWalkway ? '4 3' : undefined}
            pointerEvents="none"
          />
          {label ? (
            <text
              x={x + w / 2}
              y={y + h / 2 + 3}
              textAnchor="middle"
              fontSize={Math.min(10, cellPx * 0.5)}
              fontWeight={800}
              fill="#000000"
              pointerEvents="none"
            >
              {truncate(label, 16)}
            </text>
          ) : null}
        </g>
      )
    }
  }

  return <g aria-label="Locked venue template">{elements}</g>
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}
