'use client'

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  LayoutGrid,
  MousePointer2,
  RotateCcw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import type { CanvasToolbarBlockId } from './toolbar-order'
import {
  clearSavedStaticToolbarLayout,
  DEFAULT_STATIC_ROW_ORDER,
  getStaticRowSegmentVisibility,
  loadStaticRowCollapsed,
  loadStaticRowOrder,
  saveStaticRowCollapsed,
  saveStaticRowOrder,
  STATIC_ROW_LABELS,
  STATIC_ROW_SEGMENTS,
  type CanvasToolbarStaticRowId,
  type StaticRowCollapsedState,
} from './toolbar-static-layout'

const STATIC_ROW_ICONS: Record<
  CanvasToolbarStaticRowId,
  React.ComponentType<{ className?: string }>
> = {
  'room-tools': LayoutGrid,
  placement: Circle,
}

export interface StaticToolbarLayoutContext {
  needsRoomFirst: boolean
  showRoom: boolean
  showPatron: boolean
  showVendor: boolean
}

export interface CanvasToolbarStaticProps {
  visibleRowIds: readonly CanvasToolbarStaticRowId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
  layoutCtx?: StaticToolbarLayoutContext
}

function BlockCluster({
  blockIds,
  renderBlock,
  compact,
  className,
}: {
  blockIds: readonly CanvasToolbarBlockId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <>
      {blockIds.map((blockId) => (
        <div
          key={blockId}
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-0.5 rounded-md border border-stone-200/90 bg-white px-0.5 shadow-sm',
            compact ? 'py-0.5' : 'py-0.5',
            className
          )}
        >
          {renderBlock(blockId)}
        </div>
      ))}
    </>
  )
}

function MergedToolbarRow({
  rowId,
  label,
  index,
  total,
  expanded,
  compact,
  showLeft,
  showRight,
  onToggle,
  onMove,
  renderBlock,
}: {
  rowId: CanvasToolbarStaticRowId
  label: string
  index: number
  total: number
  expanded: boolean
  compact?: boolean
  showLeft: boolean
  showRight: boolean
  onToggle: (rowId: CanvasToolbarStaticRowId) => void
  onMove: (rowId: CanvasToolbarStaticRowId, direction: -1 | 1) => void
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
}) {
  const segments = STATIC_ROW_SEGMENTS[rowId]
  const singleSegment = showLeft !== showRight

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-md border border-stone-200/90 bg-white shadow-sm',
        compact ? 'gap-0' : 'gap-0.5'
      )}
      data-toolbar-row={rowId}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-0.5 border-b border-stone-100/90 px-0.5',
          compact ? 'py-0' : 'py-0.5',
          !expanded && 'border-b-0'
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(rowId)}
          title={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700',
            compact ? 'h-6 w-6' : 'h-7 w-7'
          )}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <TooltipWrapper text={label}>
          <span
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-sm border border-stone-200 bg-stone-50 text-stone-600',
              compact ? 'h-6 w-6' : 'h-7 w-7'
            )}
            aria-hidden
          >
            {(() => {
              const Icon = STATIC_ROW_ICONS[rowId]
              return <Icon className="h-3.5 w-3.5" />
            })()}
          </span>
        </TooltipWrapper>
        {rowId === 'room-tools' && showRight ? (
          <TooltipWrapper text="Designer tools">
            <span
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-sm border border-stone-200 bg-stone-50 text-stone-600',
                compact ? 'h-6 w-6' : 'h-7 w-7'
              )}
              aria-hidden
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </span>
          </TooltipWrapper>
        ) : null}
        <span className="min-w-0 flex-1" aria-hidden />
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(rowId, -1)}
          title={`Move ${label} up`}
          aria-label={`Move ${label} up`}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30',
            compact ? 'h-6 w-6' : 'h-7 w-7'
          )}
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => onMove(rowId, 1)}
          title={`Move ${label} down`}
          aria-label={`Move ${label} down`}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30',
            compact ? 'h-6 w-6' : 'h-7 w-7'
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {expanded ? (
        <div
          className={cn(
            'flex min-w-0 flex-col flex-wrap gap-1 md:gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:w-full',
            compact ? 'px-0.5 py-0.5' : 'px-1 py-0.5'
          )}
        >
          {showLeft ? (
            <div
              className={cn(
                'flex min-w-0 flex-wrap items-center gap-0.5',
                singleSegment ? 'w-full' : 'flex-1 lg:min-w-0 lg:max-w-[58%]'
              )}
            >
              <BlockCluster
                blockIds={segments.left}
                renderBlock={renderBlock}
                compact={compact}
              />
            </div>
          ) : null}
          {showLeft && showRight ? (
            <div
              className="hidden shrink-0 self-stretch bg-stone-200/80 lg:block lg:w-px"
              aria-hidden
            />
          ) : null}
          {showRight ? (
            <div
              className={cn(
                'flex min-w-0 flex-wrap items-center gap-0.5',
                singleSegment
                  ? 'w-full lg:justify-end'
                  : 'flex-1 lg:min-w-0 lg:justify-end'
              )}
            >
              <BlockCluster
                blockIds={segments.right}
                renderBlock={renderBlock}
                compact={compact}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Stacked dashboard ribbon — two merged rows, collapsible with persisted layout. */
export function CanvasToolbarStatic({
  visibleRowIds,
  renderBlock,
  compact,
  layoutCtx,
}: CanvasToolbarStaticProps) {
  const visibleKey = useMemo(() => visibleRowIds.join(','), [visibleRowIds])

  const [order, setOrder] = useState<CanvasToolbarStaticRowId[]>(() =>
    loadStaticRowOrder(visibleRowIds)
  )
  const [collapsed, setCollapsed] = useState<StaticRowCollapsedState>(() =>
    loadStaticRowCollapsed()
  )

  useEffect(() => {
    setOrder(loadStaticRowOrder(visibleRowIds))
  }, [visibleKey, visibleRowIds])

  const displayOrder = useMemo(() => {
    const visibleSet = new Set(visibleRowIds)
    const seen = new Set<CanvasToolbarStaticRowId>()
    const out: CanvasToolbarStaticRowId[] = []
    for (const id of order) {
      if (!visibleSet.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    for (const id of visibleRowIds) {
      if (!seen.has(id)) out.push(id)
    }
    return out
  }, [order, visibleRowIds])

  useEffect(() => {
    saveStaticRowOrder(order)
  }, [order])

  useEffect(() => {
    saveStaticRowCollapsed(collapsed)
  }, [collapsed])

  const mergeVisibleOrder = useCallback(
    (nextVisible: CanvasToolbarStaticRowId[]) => {
      const visibleSet = new Set(visibleRowIds)
      const queue = [...nextVisible]
      const merged = order.map((id) => {
        if (!visibleSet.has(id)) return id
        return queue.shift()!
      })
      for (const id of queue) {
        if (!merged.includes(id)) merged.push(id)
      }
      setOrder(merged)
    },
    [order, visibleRowIds]
  )

  const handleMove = useCallback(
    (rowId: CanvasToolbarStaticRowId, direction: -1 | 1) => {
      const idx = displayOrder.indexOf(rowId)
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

  const handleToggle = useCallback((rowId: CanvasToolbarStaticRowId) => {
    setCollapsed((prev) => ({ ...prev, [rowId]: !prev[rowId] }))
  }, [])

  const resetLayout = useCallback(() => {
    clearSavedStaticToolbarLayout()
    setOrder([...DEFAULT_STATIC_ROW_ORDER])
    setCollapsed({
      'room-tools': false,
      placement: false,
    })
  }, [])

  const segmentCtx = layoutCtx ?? {
    needsRoomFirst: false,
    showRoom: true,
    showPatron: true,
    showVendor: true,
  }

  if (displayOrder.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center justify-end">
        <TooltipWrapper text="Reset toolbar to default layout">
          <button
            type="button"
            onClick={resetLayout}
            aria-label="Reset toolbar layout"
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50',
              compact ? 'h-6 w-6' : 'h-7 w-7'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipWrapper>
      </div>
      {displayOrder.map((rowId, index) => {
        const expanded = !collapsed[rowId]
        const { left: showLeft, right: showRight } = getStaticRowSegmentVisibility(
          rowId,
          segmentCtx
        )
        return (
          <MergedToolbarRow
            key={rowId}
            rowId={rowId}
            label={STATIC_ROW_LABELS[rowId]}
            index={index}
            total={displayOrder.length}
            expanded={expanded}
            compact={compact}
            showLeft={showLeft}
            showRight={showRight}
            onToggle={handleToggle}
            onMove={handleMove}
            renderBlock={renderBlock}
          />
        )
      })}
    </div>
  )
}
