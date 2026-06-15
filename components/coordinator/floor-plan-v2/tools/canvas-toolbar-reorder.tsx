'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_CANVAS_TOOLBAR_ORDER,
  type CanvasToolbarBlockId,
} from './toolbar-order'

export interface CanvasToolbarReorderProps {
  visibleBlockIds: readonly CanvasToolbarBlockId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  className?: string
}

/** Fixed-order ribbon — blocks render in the default layout (no user reorder). */
export function CanvasToolbarReorder({
  visibleBlockIds,
  renderBlock,
  className,
}: CanvasToolbarReorderProps) {
  const visibleSet = useMemo(
    () => new Set(visibleBlockIds),
    [visibleBlockIds]
  )

  const displayOrder = useMemo(
    () => DEFAULT_CANVAS_TOOLBAR_ORDER.filter((id) => visibleSet.has(id)),
    [visibleSet]
  )

  if (displayOrder.length === 0) return null

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1',
        className
      )}
    >
      {displayOrder.map((id) => (
        <div
          key={id}
          className="inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-md border border-stone-200/90 bg-white py-0 pl-0.5 pr-0.5"
        >
          <div className="flex max-w-full flex-wrap items-center gap-0.5">
            {renderBlock(id)}
          </div>
        </div>
      ))}
    </div>
  )
}
