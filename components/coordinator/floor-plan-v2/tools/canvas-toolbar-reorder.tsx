'use client'

import { Reorder } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
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
  children,
}: {
  id: CanvasToolbarBlockId
  label: string
  children: React.ReactNode
}) {
  return (
    <Reorder.Item
      value={id}
      dragListener
      className={cn(
        'flex shrink-0 cursor-grab items-center gap-0.5 rounded-md border border-transparent',
        'bg-white pr-1.5 pl-0.5 active:cursor-grabbing',
        'data-[dragging=true]:border-stone-300 data-[dragging=true]:shadow-md'
      )}
      whileDrag={{
        scale: 1.02,
        zIndex: 40,
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      }}
      aria-label={`${label} tool group — drag to reorder`}
      title={`Drag to reorder ${label}`}
    >
      <span
        className="inline-flex h-8 w-5 shrink-0 select-none items-center justify-center text-[10px] font-bold leading-none tracking-tighter text-stone-400"
        aria-hidden
      >
        ⋮⋮
      </span>
      <div
        className="flex items-center gap-0.5"
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
 * Horizontal Reorder.Group wrapper for modular toolbar blocks.
 * Drag only from the ⋮⋮ handle; buttons inside blocks keep normal clicks.
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

  const handleReorder = useCallback(
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

  const resetOrder = useCallback(() => {
    clearSavedToolbarOrder()
    setOrder([...DEFAULT_CANVAS_TOOLBAR_ORDER])
  }, [])

  if (displayOrder.length === 0) return null

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-1',
        className
      )}
    >
      <button
        type="button"
        onClick={resetOrder}
        title="Reset toolbar to default layout"
        aria-label="Reset toolbar layout"
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-stone-200',
          'px-2 text-[10px] font-semibold text-stone-600 hover:bg-stone-50'
        )}
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">Reset layout</span>
      </button>

      <Reorder.Group
        axis="x"
        values={displayOrder}
        onReorder={handleReorder}
        className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [-webkit-overflow-scrolling:touch]"
        layoutScroll
      >
        {displayOrder.map((id, index) => (
          <div key={id} className="flex items-center gap-1">
            {index > 0 ? (
              <div
                className="mx-0.5 h-6 w-px shrink-0 bg-stone-200"
                aria-hidden
              />
            ) : null}
            <ToolbarReorderItem id={id} label={BLOCK_LABELS[id]}>
              {renderBlock(id)}
            </ToolbarReorderItem>
          </div>
        ))}
      </Reorder.Group>
    </div>
  )
}
