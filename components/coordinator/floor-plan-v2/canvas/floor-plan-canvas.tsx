'use client'

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasGrid } from './canvas-grid'
import { CanvasObjects } from './canvas-objects'
import {
  DraftPreview,
  MarqueePreview,
  SelectionOverlay,
} from './canvas-overlays'
import { useViewport, type ZoomMath } from './use-viewport'
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

  // Add a generous infinite-feeling pad around the venue so users can
  // pan into negative coordinates and place objects "off the field".
  // This pad value is also what the zoom math needs for anchoring, so
  // we compute it once here and pass it to the viewport.
  const padFt = Math.max(40, store.doc.canvasWidthFt, store.doc.canvasLengthFt)

  /**
   * Anchor priority for "discrete" zoom (buttons, reset, programmatic):
   *   1. If at least one object is selected, use the centroid of its
   *      union bounding box. Multi-select uses the union, so the camera
   *      frames the selection as a group.
   *   2. Otherwise, fall back to the absolute room center
   *      (canvasWidthFt / 2, canvasLengthFt / 2). This keeps an empty
   *      hall locked at the middle of the viewport during zoom.
   *
   * Wheel and pinch zoom override this with a screen-anchored math
   * inside the viewport hook — the cursor / finger midpoint stays
   * locked, which matches Figma / Miro behavior. The rule below is
   * the *fallback* anchor for everything else.
   */
  const getZoomMath = useCallback<() => ZoomMath>(() => {
    const objects = store.doc.objects
    const selected = store.selectedIds
    let anchorX = store.doc.canvasWidthFt / 2
    let anchorY = store.doc.canvasLengthFt / 2

    if (selected.size > 0) {
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      let any = false
      for (const o of objects) {
        if (!selected.has(o.id)) continue
        any = true
        if (o.x < minX) minX = o.x
        if (o.y < minY) minY = o.y
        if (o.x + o.width > maxX) maxX = o.x + o.width
        if (o.y + o.height > maxY) maxY = o.y + o.height
      }
      if (any) {
        anchorX = (minX + maxX) / 2
        anchorY = (minY + maxY) / 2
      }
    }

    return {
      basePxPerFt,
      padFt,
      anchorFt: { x: anchorX, y: anchorY },
    }
  }, [
    basePxPerFt,
    padFt,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
    store.doc.objects,
    store.selectedIds,
  ])

  const viewport = useViewport({
    scrollRef,
    initialZoom: 1,
    getZoomMath,
  })

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
  const padPx = padFt * pxPerFt
  const totalWidthPx = docWidthPx + padPx * 2
  const totalHeightPx = docHeightPx + padPx * 2

  /**
   * Initial centering: when the canvas first renders (or the document
   * dimensions change because the active room was switched / the user
   * resized the venue in the inspector), park the scroll container so
   * the room midpoint sits at the viewport center. This is the same
   * anchor the zoom buttons use when nothing is selected, so the
   * default frame and the zoom-target stay consistent.
   *
   * Tracked by a ref keyed on (width, length) so we don't fight the
   * user every time they manually pan or scroll.
   */
  const centeredForDimsRef = useRef<{ w: number; l: number } | null>(null)
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    if (scroll.clientWidth === 0 || scroll.clientHeight === 0) return
    const w = store.doc.canvasWidthFt
    const l = store.doc.canvasLengthFt
    const last = centeredForDimsRef.current
    if (last && last.w === w && last.l === l) return
    scroll.scrollLeft = (padFt + w / 2) * pxPerFt - scroll.clientWidth / 2
    scroll.scrollTop = (padFt + l / 2) * pxPerFt - scroll.clientHeight / 2
    centeredForDimsRef.current = { w, l }
  }, [
    padFt,
    pxPerFt,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
  ])

  const cursor = pointer.rotating
    ? 'grabbing'
    : cursorForTool(viewport.isPanning ? 'pan' : toolState.tool)

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
          {toolState.tool === 'select' ? (
            <SelectionOverlay
              objects={store.doc.objects}
              selectedIds={store.selectedIds}
              pxPerFt={pxPerFt}
              suppressHandle={pointer.draftRect !== null}
            />
          ) : null}
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
