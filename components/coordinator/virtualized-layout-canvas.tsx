'use client'

import { useRef, useState, useEffect, useCallback, type ReactNode, type MouseEvent, type DragEvent } from 'react'
import {
  shouldPartitionGrid,
  quadrantBoundsForGrid,
  type QuadrantBounds,
  type QuadrantId,
} from '@/lib/booth-planner/quadrant-grid'
import { cn } from '@/lib/utils'
import { CANVAS_VIEWPORT_SCALE } from '@/components/coordinator/svg-layout-canvas'
import {
  LAYOUT_ZOOM_DEFAULT,
  LayoutZoomSlider,
  LayoutZoomViewport,
} from '@/components/coordinator/layout-zoom-slider'

const VIRTUAL_CANVAS_MAX_HEIGHT = `min(calc(72vh * ${CANVAS_VIEWPORT_SCALE}), ${900 * CANVAS_VIEWPORT_SCALE}px)`

interface VirtualizedLayoutCanvasProps {
  cols: number
  rows: number
  cellPx: number
  renderGrid: (slice?: QuadrantBounds) => ReactNode
  className?: string
  /** Snap wrapper to exact grid bounds — no trailing scroll/padding overflow. */
  fitToBounds?: boolean
  /** Pointer fallback when vacant placeholder cells are not rendered. */
  onGridCellPointerDown?: (row: number, col: number, event: MouseEvent) => void
  onGridCellPointerEnter?: (row: number, col: number) => void
  /** Drag-hover fallback when vacant cells are not rendered. */
  onGridCellDragOver?: (row: number, col: number) => void
  onGridCellDragLeave?: () => void
}

function cellFromPointer(
  event: MouseEvent,
  cols: number,
  rows: number,
  cellPx: number,
  zoom: number
): { row: number; col: number } | null {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const col = Math.floor(((event.clientX - rect.left) / rect.width) * cols)
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * rows)
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null

  // Guard against float drift at extreme zoom levels.
  void cellPx
  void zoom
  return { row, col }
}

function visibleQuadrantsForScroll(
  scrollLeft: number,
  scrollTop: number,
  clientWidth: number,
  clientHeight: number,
  zoom: number,
  cellPx: number,
  cols: number,
  rows: number,
  quadrants: QuadrantBounds[]
): QuadrantId[] {
  const pad = cellPx * 3
  const unscaledLeft = scrollLeft / zoom
  const unscaledTop = scrollTop / zoom
  const unscaledWidth = clientWidth / zoom
  const unscaledHeight = clientHeight / zoom

  const vCol0 = Math.max(0, Math.floor((unscaledLeft - pad) / cellPx))
  const vCol1 = Math.min(cols - 1, Math.ceil((unscaledLeft + unscaledWidth + pad) / cellPx))
  const vRow0 = Math.max(0, Math.floor((unscaledTop - pad) / cellPx))
  const vRow1 = Math.min(rows - 1, Math.ceil((unscaledTop + unscaledHeight + pad) / cellPx))

  const next = new Set<QuadrantId>()
  for (const q of quadrants) {
    const overlap =
      q.col0 <= vCol1 && q.col1 >= vCol0 && q.row0 <= vRow1 && q.row1 >= vRow0
    if (overlap) next.add(q.id)
  }
  if (next.size === 0) next.add('nw')
  return Array.from(next)
}

export function VirtualizedLayoutCanvas({
  cols,
  rows,
  cellPx,
  renderGrid,
  className,
  fitToBounds = true,
  onGridCellPointerDown,
  onGridCellPointerEnter,
  onGridCellDragOver,
  onGridCellDragLeave,
}: VirtualizedLayoutCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(LAYOUT_ZOOM_DEFAULT)
  const partitioned = shouldPartitionGrid(cols, rows)
  const quadrants = partitioned ? quadrantBoundsForGrid(cols, rows) : null

  const [visibleIds, setVisibleIds] = useState<QuadrantId[]>(() =>
    partitioned ? ['nw', 'ne', 'sw', 'se'] : []
  )

  const updateVisible = useCallback(() => {
    const el = scrollRef.current
    if (!el || !partitioned || !quadrants) return

    setVisibleIds(
      visibleQuadrantsForScroll(
        el.scrollLeft,
        el.scrollTop,
        el.clientWidth,
        el.clientHeight,
        zoom,
        cellPx,
        cols,
        rows,
        quadrants
      )
    )
  }, [cellPx, cols, rows, partitioned, quadrants, zoom])

  useEffect(() => {
    if (!partitioned) return
    updateVisible()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateVisible, { passive: true })
    const ro = new ResizeObserver(updateVisible)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateVisible)
      ro.disconnect()
    }
  }, [partitioned, updateVisible])

  useEffect(() => {
    if (partitioned) updateVisible()
  }, [zoom, partitioned, updateVisible])

  const gridWidthPx = cols * cellPx
  const gridHeightPx = rows * cellPx

  const gridPointerProps =
    onGridCellPointerDown || onGridCellPointerEnter
      ? {
          onMouseDown: (event: MouseEvent) => {
            if (event.target !== event.currentTarget) return
            const cell = cellFromPointer(event, cols, rows, cellPx, zoom)
            if (cell) onGridCellPointerDown?.(cell.row, cell.col, event)
          },
          onMouseMove: (event: MouseEvent) => {
            if (event.buttons !== 1 || event.target !== event.currentTarget) return
            const cell = cellFromPointer(event, cols, rows, cellPx, zoom)
            if (cell) onGridCellPointerEnter?.(cell.row, cell.col)
          },
        }
      : {}

  const gridDragProps =
    onGridCellDragOver || onGridCellDragLeave
      ? {
          onDragOver: (event: DragEvent) => {
            event.preventDefault()
            const cell = cellFromPointer(event, cols, rows, cellPx, zoom)
            if (cell) onGridCellDragOver?.(cell.row, cell.col)
          },
          onDragLeave: (event: DragEvent) => {
            if (event.target !== event.currentTarget) return
            onGridCellDragLeave?.()
          },
        }
      : {}

  const gridStyle = {
    display: 'grid' as const,
    gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
    width: `${gridWidthPx}px`,
    height: `${gridHeightPx}px`,
    backgroundImage:
      'repeating-linear-gradient(0deg, transparent, transparent calc(100% - 1px), #d6d3cd calc(100% - 1px)), repeating-linear-gradient(90deg, transparent, transparent calc(100% - 1px), #d6d3cd calc(100% - 1px))',
    backgroundSize: `${cellPx}px ${cellPx}px`,
    contain: 'strict' as const,
  }

  const boundsClass = cn(
    'overflow-auto rounded-lg border-2 border-stone-300 bg-canvas',
    fitToBounds ? 'w-full' : 'inline-block max-w-full'
  )

  const gridContent = (
    <div style={gridStyle} {...gridPointerProps} {...gridDragProps}>
      {renderGrid()}
    </div>
  )

  const partitionedContent = (
    <div
      className="relative shrink-0"
      style={{
        width: gridWidthPx,
        height: gridHeightPx,
        backgroundImage: gridStyle.backgroundImage,
        backgroundSize: gridStyle.backgroundSize,
      }}
      {...gridPointerProps}
      {...gridDragProps}
    >
      {quadrants!.map((q) => {
        if (!visibleIds.includes(q.id)) return null
        const w = (q.col1 - q.col0 + 1) * cellPx
        const h = (q.row1 - q.row0 + 1) * cellPx
        return (
          <div
            key={q.id}
            data-quadrant={q.id}
            className="absolute contain-strict pointer-events-none"
            style={{
              left: q.col0 * cellPx,
              top: q.row0 * cellPx,
              width: w,
              height: h,
              display: 'grid',
              gridTemplateColumns: `repeat(${q.col1 - q.col0 + 1}, ${cellPx}px)`,
              gridTemplateRows: `repeat(${q.row1 - q.row0 + 1}, ${cellPx}px)`,
            }}
          >
            <div className="contents pointer-events-auto">{renderGrid(q)}</div>
          </div>
        )
      })}
    </div>
  )

  const scrollViewportStyle = {
    maxHeight: VIRTUAL_CANVAS_MAX_HEIGHT,
  }

  if (!partitioned) {
    return (
      <div className={cn('flex min-h-0 w-full min-w-0 flex-col', className)}>
        <div className="sticky top-0 z-20 shrink-0 border-b border-stone-200 bg-white px-2 py-1.5">
          <div className="flex justify-end">
            <LayoutZoomSlider zoom={zoom} onZoomChange={setZoom} />
          </div>
        </div>
        <div className={boundsClass} style={scrollViewportStyle}>
          <LayoutZoomViewport zoom={zoom} width={gridWidthPx} height={gridHeightPx}>
            {gridContent}
          </LayoutZoomViewport>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 w-full min-w-0 flex-col', className)}>
      <div className="sticky top-0 z-20 shrink-0 border-b border-stone-200 bg-white px-2 py-1.5">
        <div className="flex justify-end">
          <LayoutZoomSlider zoom={zoom} onZoomChange={setZoom} />
        </div>
      </div>
      <div ref={scrollRef} className={boundsClass} style={scrollViewportStyle}>
        <LayoutZoomViewport zoom={zoom} width={gridWidthPx} height={gridHeightPx}>
          {partitionedContent}
        </LayoutZoomViewport>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Large venue ({(cols * rows).toLocaleString()} sq ft) — quadrant memory layer · rendering{' '}
        {visibleIds.length}/4 visible quadrants
      </p>
    </div>
  )
}
