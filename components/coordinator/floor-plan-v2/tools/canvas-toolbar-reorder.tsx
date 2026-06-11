'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import {
  clearSavedToolbarOrder,
  DEFAULT_CANVAS_TOOLBAR_ORDER,
  loadToolbarOrder,
  saveToolbarOrder,
  type CanvasToolbarBlockId,
} from './toolbar-order'

export interface CanvasToolbarReorderProps {
  visibleBlockIds: readonly CanvasToolbarBlockId[]
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
        'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-md border border-stone-200/90',
        'bg-white py-0 pl-0.5 pr-0.5',
        'data-[dragging=true]:z-20 data-[dragging=true]:border-stone-300 data-[dragging=true]:shadow-md'
      )}
      whileDrag={{
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
      aria-label={`${label} tool group`}
    >
      <button
        type="button"
        className={cn(
          'inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded-sm',
          'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
          'touch-none active:cursor-grabbing'
        )}
        title={`Drag to reorder ${label}`}
        aria-label={`Reorder ${label}`}
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
        title={`Move ${label} earlier`}
        aria-label={`Move ${label} earlier`}
        className="inline-flex h-6 w-4 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        disabled={index >= total - 1}
        onClick={() => onMove(id, 1)}
        title={`Move ${label} later`}
        aria-label={`Move ${label} later`}
        className="inline-flex h-6 w-4 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
      >
        <ChevronRight className="h-3 w-3" aria-hidden />
      </button>
      <div
        className="flex max-w-full flex-wrap items-center gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </Reorder.Item>
  )
}

const BLOCK_LABELS: Record<CanvasToolbarBlockId, string> = {
  optimize: 'Auto-arrange floor plan',
  primitives: 'Canvas tools',
  'history-clipboard': 'History and clipboard',
  'view-align': 'View and alignment',
  vendor: 'Vendor',
  'vendor-sizes': 'Booth sizes',
  patron: 'Patron',
  room: 'Room layout',
  utilities: 'View and save',
  'dual-screen': 'Dual-screen',
}

/** Compact wrapping ribbon — blocks size to content and never span full column width. */
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
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1',
        className
      )}
    >
      <TooltipWrapper text="Reset toolbar to default layout">
        <button
          type="button"
          onClick={resetOrder}
          aria-label="Reset toolbar layout"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-stone-200',
            'text-stone-600 hover:bg-stone-50'
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipWrapper>

      <Reorder.Group
        axis="x"
        values={displayOrder}
        onReorder={handleReorder}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1"
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
