'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  clearSavedToolbarOrder,
  DEFAULT_CANVAS_TOOLBAR_ORDER,
  loadToolbarOrder,
  saveToolbarOrder,
  type CanvasToolbarBlockId,
} from './toolbar-order'

export interface CanvasToolbarReorderProps {
  /** Which blocks are currently visible (filtered before render). */
  visibleBlockIds: readonly CanvasToolbarBlockId[]
  /** Render the tools inside a block — wire existing onClick handlers here. */
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  className?: string
}

function ToolbarReorderItem({
  id,
  label,
  index,
  total,
  onMove,
  children,
}: {
  id: CanvasToolbarBlockId
  label: string
  index: number
  total: number
  onMove: (id: CanvasToolbarBlockId, direction: -1 | 1) => void
  children: React.ReactNode
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        'flex w-full min-w-0 items-start gap-1 rounded-md border border-stone-200/90',
        'bg-white py-1 pl-0.5 pr-1.5 shadow-sm',
        'data-[dragging=true]:z-20 data-[dragging=true]:border-stone-300 data-[dragging=true]:shadow-md'
      )}
      whileDrag={{
        zIndex: 30,
        boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
      }}
      aria-label={`${label} tool row`}
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
        <button
          type="button"
          className={cn(
            'inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-sm',
            'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
            'touch-none active:cursor-grabbing'
          )}
          title={`Drag ${label} up or down`}
          aria-label={`Drag to reorder ${label}`}
          onPointerDown={(e) => {
            e.preventDefault()
            dragControls.start(e)
          }}
        >
          <span
            className="select-none text-[10px] font-bold leading-none tracking-tighter"
            aria-hidden
          >
            ⋮⋮
          </span>
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(id, -1)}
          title={`Move ${label} up`}
          aria-label={`Move ${label} up`}
          className="inline-flex h-6 w-7 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => onMove(id, 1)}
          title={`Move ${label} down`}
          aria-label={`Move ${label} down`}
          className="inline-flex h-6 w-7 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 py-0.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </Reorder.Item>
  )
}

const BLOCK_LABELS: Record<CanvasToolbarBlockId, string> = {
  primitives: 'Primitive tools',
  'history-clipboard': 'History and clipboard',
  'view-align': 'View and alignment',
  'room-transform': 'Room transform',
  arrangement: 'Arrangement engine',
  'table-size': 'Table size',
  rooms: 'Rooms',
  utilities: 'View and save',
}

/**
 * Vertical stack of toolbar rows — drag or use arrows to move rows up/down.
 * Each row is isolated so groups never overlap.
 */
export function CanvasToolbarReorder({
  visibleBlockIds,
  renderBlock,
  className,
}: CanvasToolbarReorderProps) {
  const [order, setOrder] = useState<CanvasToolbarBlockId[]>(() =>
    loadToolbarOrder()
  )

  useEffect(() => {
    saveToolbarOrder(order)
  }, [order])

  const visibleSet = useMemo(
    () => new Set(visibleBlockIds),
    [visibleBlockIds]
  )

  const displayOrder = useMemo(
    () => order.filter((id) => visibleSet.has(id)),
    [order, visibleSet]
  )

  const mergeVisibleOrder = useCallback(
    (nextVisible: CanvasToolbarBlockId[]) => {
      const visibleQueue = [...nextVisible]
      const merged = order.map((id) => {
        if (!visibleSet.has(id)) return id
        return visibleQueue.shift()!
      })
      for (const id of visibleQueue) {
        if (!merged.includes(id)) merged.push(id)
      }
      setOrder(merged)
    },
    [order, visibleSet]
  )

  const handleReorder = useCallback(
    (nextVisible: CanvasToolbarBlockId[]) => {
      mergeVisibleOrder(nextVisible)
    },
    [mergeVisibleOrder]
  )

  const handleMove = useCallback(
    (id: CanvasToolbarBlockId, direction: -1 | 1) => {
      const idx = displayOrder.indexOf(id)
      if (idx < 0) return
      const target = idx + direction
      if (target < 0 || target >= displayOrder.length) return
      const next = [...displayOrder]
      const tmp = next[idx]!
      next[idx] = next[target]!
      next[target] = tmp
      mergeVisibleOrder(next)
    },
    [displayOrder, mergeVisibleOrder]
  )

  const resetOrder = useCallback(() => {
    clearSavedToolbarOrder()
    setOrder([...DEFAULT_CANVAS_TOOLBAR_ORDER])
  }, [])

  if (displayOrder.length === 0) return null

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={resetOrder}
        title="Reset toolbar to default layout"
        aria-label="Reset toolbar layout"
        className={cn(
          'inline-flex h-8 w-fit shrink-0 items-center gap-1 rounded-md border border-stone-200',
          'px-2 text-[10px] font-semibold text-stone-600 hover:bg-stone-50'
        )}
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">Reset layout</span>
      </button>

      <Reorder.Group
        axis="y"
        values={displayOrder}
        onReorder={handleReorder}
        className="flex w-full min-w-0 flex-col gap-1.5"
      >
        {displayOrder.map((id, index) => (
          <ToolbarReorderItem
            key={id}
            id={id}
            label={BLOCK_LABELS[id]}
            index={index}
            total={displayOrder.length}
            onMove={handleMove}
          >
            {renderBlock(id)}
          </ToolbarReorderItem>
        ))}
      </Reorder.Group>
    </div>
  )
}
