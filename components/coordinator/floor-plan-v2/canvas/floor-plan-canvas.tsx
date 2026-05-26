'use client'

import { useMemo, useRef } from 'react'
import { CanvasGrid } from './canvas-grid'
import { CanvasObjects } from './canvas-objects'
import { DraftPreview, MarqueePreview } from './canvas-overlays'
import { useViewport } from './use-viewport'
import { useCanvasPointer } from '../interactions/use-canvas-pointer'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import type { ToolState } from '../tools/types'
import { cn } from '@/lib/utils'

interface FloorPlanCanvasProps {
  store: FloorPlanDocStore
  toolState: ToolState
  onAfterDrawCommit?: () => void
  className?: string
  /** Fixed pixels-per-foot at zoom = 1. */
  basePxPerFt?: number
}

const DEFAULT_BASE_PX_PER_FT = 12

export function FloorPlanCanvas({
  store,
  toolState,
  onAfterDrawCommit,
  className,
  basePxPerFt = DEFAULT_BASE_PX_PER_FT,
}: FloorPlanCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<SVGSVGElement>(null)
  const viewport = useViewport(scrollRef, 1)

  const transform = useMemo(
    () => ({ basePxPerFt, zoom: viewport.zoom }),
    [basePxPerFt, viewport.zoom]
  )

  const pointer = useCanvasPointer({
    store,
    toolState,
    scrollRef,
    surfaceRef,
    transform,
    panActive: viewport.panActive,
    onAfterDrawCommit,
  })

  const pxPerFt = transform.basePxPerFt * transform.zoom
  const docWidthPx = store.doc.canvasWidthFt * pxPerFt
  const docHeightPx = store.doc.canvasLengthFt * pxPerFt

  // Add a generous infinite-feeling pad around the venue so users can
  // pan into negative coordinates and place objects "off the field".
  const padFt = Math.max(40, store.doc.canvasWidthFt, store.doc.canvasLengthFt)
  const padPx = padFt * pxPerFt
  const totalWidthPx = docWidthPx + padPx * 2
  const totalHeightPx = docHeightPx + padPx * 2

  const cursor = cursorForTool(viewport.isPanning ? 'pan' : toolState.tool)

  return (
    <div
      ref={scrollRef}
      className={cn(
        'relative h-full w-full overflow-auto bg-stone-50 outline-none',
        className
      )}
      tabIndex={0}
      role="application"
      aria-label="Floor plan canvas viewport"
      style={{ touchAction: 'none', cursor }}
      {...viewport.scrollHandlers}
    >
      <div
        style={{
          width: totalWidthPx,
          height: totalHeightPx,
          position: 'relative',
        }}
      >
        <svg
          ref={surfaceRef}
          width={docWidthPx}
          height={docHeightPx}
          style={{
            position: 'absolute',
            left: padPx,
            top: padPx,
            display: 'block',
            background: '#fafaf9',
            boxShadow: '0 0 0 1px #e7e5e4, 0 12px 28px rgba(28,25,23,0.08)',
            cursor,
          }}
          onPointerDown={pointer.onPointerDown}
          onPointerMove={pointer.onPointerMove}
          onPointerUp={pointer.onPointerUp}
          onPointerCancel={pointer.onPointerUp}
          onContextMenu={pointer.onContextMenu}
        >
          <CanvasGrid
            widthFt={store.doc.canvasWidthFt}
            lengthFt={store.doc.canvasLengthFt}
            spacingFt={store.doc.gridSpacingFt}
            pxPerFt={pxPerFt}
          />
          <CanvasObjects
            objects={store.doc.objects}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
          />
          <DraftPreview
            rect={pointer.draftRect}
            kind={pointer.draftKind}
            pxPerFt={pxPerFt}
          />
          <MarqueePreview rect={pointer.marqueeRect} pxPerFt={pxPerFt} />
        </svg>
      </div>
      <ZoomBadge
        zoom={viewport.zoom}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onReset={viewport.resetZoom}
      />
    </div>
  )
}

function cursorForTool(tool: 'hand' | 'select' | 'draw' | 'pan'): string {
  switch (tool) {
    case 'pan':
      return 'grabbing'
    case 'hand':
      return 'grab'
    case 'draw':
      return 'crosshair'
    case 'select':
    default:
      return 'default'
  }
}

function ZoomBadge({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-stone-300 bg-white/95 px-1.5 py-1 text-xs font-semibold text-stone-700 shadow-sm">
      <button
        type="button"
        onClick={onZoomOut}
        className="pointer-events-auto rounded px-1.5 py-0.5 hover:bg-stone-100"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        className="pointer-events-auto min-w-[3.25rem] rounded px-1.5 py-0.5 text-center tabular-nums hover:bg-stone-100"
        aria-label="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="pointer-events-auto rounded px-1.5 py-0.5 hover:bg-stone-100"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  )
}
