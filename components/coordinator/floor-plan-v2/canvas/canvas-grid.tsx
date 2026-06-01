'use client'

import { memo, useId } from 'react'

interface CanvasGridProps {
  widthFt: number
  lengthFt: number
  spacingFt: number
  pxPerFt: number
  /** Major line every N minor cells (default 5). */
  majorEvery?: number
}

/**
 * Background grid for the v2 canvas. This is a *visual aid only* — the
 * grid never enforces placement, never blocks interactions, and never
 * triggers preset application. Objects can sit on grid lines, between
 * them, or completely off the venue rectangle.
 *
 * Two SVG pattern tiles (minor + major strokes) plus the advisory
 * venue outline. Spacing comes from the active TABLE SIZE pill.
 */
function CanvasGridBase({
  widthFt,
  lengthFt,
  spacingFt,
  pxPerFt,
  majorEvery = 5,
}: CanvasGridProps) {
  const widthPx = widthFt * pxPerFt
  const heightPx = lengthFt * pxPerFt
  const minorPx = spacingFt * pxPerFt
  const majorPx = spacingFt * majorEvery * pxPerFt

  const baseId = useId().replace(/[:]/g, '')
  const ids = {
    minor: `fp-grid-minor-${baseId}`,
    major: `fp-grid-major-${baseId}`,
  }

  return (
    <g aria-hidden className="canvas-overlay-layer" pointerEvents="none">
      <defs>
        <pattern
          id={ids.minor}
          width={minorPx}
          height={minorPx}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${minorPx} 0 L 0 0 0 ${minorPx}`}
            fill="none"
            stroke="#E7E5E4"
            strokeWidth={0.5}
          />
        </pattern>
        <pattern
          id={ids.major}
          width={majorPx}
          height={majorPx}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${majorPx} 0 L 0 0 0 ${majorPx}`}
            fill="none"
            stroke="#D6D3D1"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect
        x={0}
        y={0}
        width={widthPx}
        height={heightPx}
        fill={`url(#${ids.minor})`}
      />
      <rect
        x={0}
        y={0}
        width={widthPx}
        height={heightPx}
        fill={`url(#${ids.major})`}
      />
      <rect
        x={0}
        y={0}
        width={widthPx}
        height={heightPx}
        fill="none"
        stroke="#1c1917"
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    </g>
  )
}

export const CanvasGrid = memo(CanvasGridBase)
