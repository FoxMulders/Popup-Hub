'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  CanvasPerimeterFacingControls,
  FACING_CONTROL_DEFAULT_MARGIN,
  facingControlGutter,
  type CanvasPerimeterFacingControlsProps,
} from '@/components/coordinator/canvas-perimeter-facing-controls'
import {
  LAYOUT_ZOOM_DEFAULT,
  LayoutZoomSlider,
  LayoutZoomViewport,
} from '@/components/coordinator/layout-zoom-slider'

/** 1 grid unit = 1 foot = 20px on the SVG workspace. */
export const SVG_FOOT_PX = 20

/** Legacy scale retained for virtualized canvas. */
export const CANVAS_VIEWPORT_SCALE = 1.75
export const SVG_MAJOR_LANE_FT = 8
export const SVG_MAJOR_LANE_PX = SVG_FOOT_PX * SVG_MAJOR_LANE_FT

export interface SvgLayoutCanvasProps {
  cols: number
  rows: number
  /** Hall interior row count when rows includes a north annex band. */
  hallRows?: number
  cellPx?: number
  /** Extra feet rendered outside each wall for off-floor annexes (stage alcove, etc.). */
  annexFt?: { north?: number; south?: number; east?: number; west?: number }
  /** @deprecated Canvas renders at 1:1; use browser zoom. Kept for API compatibility. */
  fitToView?: boolean
  /** Primary actions rendered in the canvas header ribbon (Smart Populate, etc.). */
  headerActions?: ReactNode
  /** @deprecated Use perimeterFacing — floating box overlay removed. */
  viewportOverlay?: ReactNode
  /** Storefront direction pads on the hall perimeter. */
  perimeterFacing?: Omit<
    CanvasPerimeterFacingControlsProps,
    'hallLeft' | 'hallTop' | 'hallWidth' | 'hallHeight'
  >
  children: ReactNode
  className?: string
  roomLabel?: string
}

export function SvgLayoutCanvas({
  cols,
  rows,
  hallRows = rows,
  cellPx = SVG_FOOT_PX,
  annexFt,
  headerActions,
  viewportOverlay,
  perimeterFacing,
  children,
  className,
  roomLabel,
}: SvgLayoutCanvasProps) {
  const uid = useId().replace(/:/g, '')
  const [zoom, setZoom] = useState(LAYOUT_ZOOM_DEFAULT)
  const minorGridId = `minor-1ft-grid-${uid}`
  const majorLaneId = `major-8ft-lane-${uid}`

  const annexNorthPx = (annexFt?.north ?? 0) * cellPx
  const annexSouthPx = (annexFt?.south ?? 0) * cellPx
  const annexWestPx = (annexFt?.west ?? 0) * cellPx
  const annexEastPx = (annexFt?.east ?? 0) * cellPx

  const widthPx = cols * cellPx + annexWestPx + annexEastPx
  const heightPx = rows * cellPx + annexNorthPx + annexSouthPx
  const hallOriginX = annexWestPx
  const hallOriginY = annexSouthPx
  const hallWidthPx = cols * cellPx
  const hallHeightPx = hallRows * cellPx
  const gridHeightPx = rows * cellPx

  const facingMargin = perimeterFacing?.margin ?? FACING_CONTROL_DEFAULT_MARGIN
  const controlGutter = perimeterFacing ? facingControlGutter(facingMargin) : 0
  const wrapperWidth = widthPx + controlGutter * 2
  const wrapperHeight = heightPx + controlGutter * 2
  const hallLeftForControls = hallOriginX + controlGutter
  const hallTopForControls = hallOriginY + controlGutter

  return (
    <div className={cn('flex w-full min-h-0 flex-col', className)}>
      <div className="sticky top-0 z-20 shrink-0 border-b border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-black shrink-0 truncate min-w-0">
            {roomLabel ?? `${cols}′ × ${rows}′ · 1′ grid`}
          </p>
          <LayoutZoomSlider zoom={zoom} onZoomChange={setZoom} className="shrink-0" />
        </div>
        {headerActions ? (
          <div
            className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-2 py-1.5"
            role="toolbar"
            aria-label="Floor plan actions"
          >
            {headerActions}
          </div>
        ) : null}
      </div>
      <div
        className="relative min-h-[240px] max-h-[min(72vh,960px)] w-full min-w-0 overflow-auto bg-zinc-100"
      >
        {viewportOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">{viewportOverlay}</div>
        ) : null}
        <LayoutZoomViewport zoom={zoom} width={wrapperWidth} height={wrapperHeight}>
          <div
            className="relative shrink-0"
            style={{ width: wrapperWidth, height: wrapperHeight }}
          >
          {perimeterFacing ? (
            <CanvasPerimeterFacingControls
              hallLeft={hallLeftForControls}
              hallTop={hallTopForControls}
              hallWidth={hallWidthPx}
              hallHeight={hallHeightPx}
              margin={facingMargin}
              {...perimeterFacing}
            />
          ) : null}
          <svg
            width={widthPx}
            height={heightPx}
            viewBox={`0 0 ${widthPx} ${heightPx}`}
            xmlns="http://www.w3.org/2000/svg"
            className="absolute block select-none"
            style={{ left: controlGutter, top: controlGutter, width: widthPx, height: heightPx }}
            role="img"
            aria-label={`Floor plan ${cols} by ${rows} feet`}
          >
            <defs>
              <pattern
                id={minorGridId}
                width={cellPx}
                height={cellPx}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${cellPx} 0 L 0 0 0 ${cellPx}`}
                  fill="none"
                  stroke="#e4e4e7"
                  strokeWidth={1}
                />
              </pattern>
              <pattern
                id={majorLaneId}
                width={SVG_MAJOR_LANE_PX}
                height={SVG_MAJOR_LANE_PX}
                patternUnits="userSpaceOnUse"
              >
                <rect width={SVG_MAJOR_LANE_PX} height={SVG_MAJOR_LANE_PX} fill={`url(#${minorGridId})`} />
                <path
                  d={`M ${SVG_MAJOR_LANE_PX} 0 L 0 0 0 ${SVG_MAJOR_LANE_PX}`}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                />
              </pattern>
            </defs>
            <rect
              x={hallOriginX}
              y={hallOriginY}
              width={hallWidthPx}
              height={gridHeightPx}
              fill={`url(#${majorLaneId})`}
            />
            {hallRows < rows ? (
              <line
                x1={hallOriginX}
                y1={hallOriginY + hallHeightPx}
                x2={hallOriginX + hallWidthPx}
                y2={hallOriginY + hallHeightPx}
                stroke="#78716C"
                strokeWidth={3}
                pointerEvents="none"
              />
            ) : null}
            <g transform={`translate(${hallOriginX}, ${hallOriginY})`}>{children}</g>
          </svg>
          </div>
        </LayoutZoomViewport>
      </div>
    </div>
  )
}
