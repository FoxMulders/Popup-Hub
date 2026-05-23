'use client'

import type { OffFloorZone } from '@/lib/booth-planner/off-floor-zones'
import { SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'

const ZONE_FILL: Record<string, string> = {
  stage: '#E7E5E4',
  stairs: '#D4D4D8',
  service: '#F5F5F4',
}

export interface SvgOffFloorAnnexProps {
  cols: number
  rows: number
  cellPx?: number
  zones: OffFloorZone[]
}

/** Adjacent rooms (stage alcove, stairs) rendered outside the hall perimeter — not on the vendor grid. */
export function SvgOffFloorAnnex({
  cols,
  rows,
  cellPx = SVG_FOOT_PX,
  zones,
}: SvgOffFloorAnnexProps) {
  if (zones.length === 0) return null

  const hallW = cols * cellPx
  const hallH = rows * cellPx

  return (
    <g aria-label="Off-floor adjacent rooms" pointerEvents="none">
      {zones.map((zone) => {
        const depthPx = zone.depthFt * cellPx
        const spanPx = (zone.widthFt ?? zone.colSpan) * cellPx
        const fill = ZONE_FILL[zone.kind ?? 'service'] ?? '#E7E5E4'

        if (zone.wall === 'north') {
          const x = zone.col * cellPx
          const y = hallH
          const isStairs = zone.kind === 'stairs'
          return (
            <g key={`${zone.wall}-${zone.col}-${zone.label}`}>
              <rect
                x={x}
                y={y}
                width={spanPx}
                height={depthPx}
                fill={fill}
                stroke="#000000"
                strokeWidth={2.5}
              />
              {isStairs ? (
                <StairSymbol x={x} y={y} width={spanPx} height={depthPx} />
              ) : (
                <>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={spanPx - 4}
                    height={depthPx - 4}
                    fill="none"
                    stroke="#71717a"
                    strokeWidth={1}
                    strokeDasharray="5 4"
                  />
                  <text
                    x={x + spanPx / 2}
                    y={y + depthPx / 2 + 4}
                    textAnchor="middle"
                    fontSize={Math.min(11, cellPx * 0.55)}
                    fontWeight={900}
                    fill="#000000"
                  >
                    {zone.label}
                  </text>
                </>
              )}
            </g>
          )
        }

        if (zone.wall === 'south') {
          const x = zone.col * cellPx
          const y = -depthPx
          return (
            <g key={`${zone.wall}-${zone.col}-${zone.label}`}>
              <rect x={x} y={y} width={spanPx} height={depthPx} fill={fill} stroke="#000000" strokeWidth={2.5} />
              <text
                x={x + spanPx / 2}
                y={y + depthPx / 2 + 4}
                textAnchor="middle"
                fontSize={Math.min(11, cellPx * 0.55)}
                fontWeight={900}
                fill="#000000"
              >
                {zone.label}
              </text>
            </g>
          )
        }

        return null
      })}

      {/* Emphasize hall north wall — stage/stairs sit beyond this line, not inside it. */}
      {zones.some((z) => z.wall === 'north') ? (
        <line
          x1={0}
          y1={hallH}
          x2={hallW}
          y2={hallH}
          stroke="#000000"
          strokeWidth={4}
        />
      ) : null}
    </g>
  )
}

function StairSymbol({
  x,
  y,
  width,
  height,
}: {
  x: number
  y: number
  width: number
  height: number
}) {
  const treadCount = 5
  const padX = width * 0.12
  const padY = height * 0.15
  const treadGap = (height - padY * 2) / (treadCount + 1)
  const lines: React.ReactElement[] = []
  for (let i = 0; i < treadCount; i++) {
    const ty = y + padY + treadGap * (i + 1)
    lines.push(
      <line
        key={`tread-${i}`}
        x1={x + padX}
        y1={ty}
        x2={x + width - padX}
        y2={ty}
        stroke="#52525b"
        strokeWidth={1.5}
      />
    )
  }
  const arrowY = y + height * 0.72
  return (
    <g aria-label="Stairs">
      {lines}
      <path
        d={`M ${x + width * 0.55} ${arrowY} L ${x + width * 0.72} ${arrowY - height * 0.12} L ${x + width * 0.72} ${arrowY + height * 0.04} Z`}
        fill="#18181b"
      />
      <text
        x={x + width / 2}
        y={y + height * 0.28}
        textAnchor="middle"
        fontSize={Math.min(10, width * 0.14)}
        fontWeight={800}
        fill="#18181b"
      >
        STAIRS
      </text>
    </g>
  )
}
