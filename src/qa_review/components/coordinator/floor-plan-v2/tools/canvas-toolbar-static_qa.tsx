'use client'

import { ChevronDown, ChevronRight, ChevronUp, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TooltipWrapperQa } from '@/src/qa_review/components/coordinator/dashboard/tooltip-wrapper_qa'
import {
  QA_ACCORDION_HEADERS,
  QaAccordionHeader,
} from '@/src/qa_review/components/coordinator/dashboard/Dashboard_qa'
import { cn } from '@/lib/utils'
import type { CanvasToolbarBlockId } from '@/components/coordinator/floor-plan-v2/tools/toolbar-order'
import {
  clearSavedStaticToolbarLayout,
  DEFAULT_STATIC_ROW_ORDER,
  loadStaticRowCollapsed,
  loadStaticRowOrder,
  saveStaticRowCollapsed,
  saveStaticRowOrder,
  STATIC_ROW_BLOCKS,
  type CanvasToolbarStaticRowId,
  type StaticRowCollapsedState,
} from '@/components/coordinator/floor-plan-v2/tools/toolbar-static-layout'

import {
  QA_TIP_COLLAPSE,
  QA_TIP_EXPAND,
  QA_TIP_MOVE_DOWN,
  QA_TIP_MOVE_UP,
  QA_TIP_RESET_LAYOUT,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/toolbar-tooltip-copy_qa'

export interface CanvasToolbarStaticQaProps {
  visibleRowIds: readonly CanvasToolbarStaticRowId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
}

function StaticToolbarRow({
  rowId,
  header,
  index,
  total,
  expanded,
  compact,
  onToggle,
  onMove,
  children,
}: {
  rowId: CanvasToolbarStaticRowId
  header: string
  index: number
  total: number
  expanded: boolean
  compact?: boolean
  onToggle: (rowId: CanvasToolbarStaticRowId) => void
  onMove: (rowId: CanvasToolbarStaticRowId, direction: -1 | 1) => void
  children: React.ReactNode
}) {
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
          title={expanded ? QA_TIP_COLLAPSE : QA_TIP_EXPAND}
          aria-label={expanded ? `${QA_TIP_COLLAPSE} ${header}` : `${QA_TIP_EXPAND} ${header}`}
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
        <div className="min-w-0 flex-1 truncate">
          <QaAccordionHeader>{header}</QaAccordionHeader>
        </div>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(rowId, -1)}
          title={QA_TIP_MOVE_UP}
          aria-label={`${QA_TIP_MOVE_UP} ${header}`}
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
          title={QA_TIP_MOVE_DOWN}
          aria-label={`${QA_TIP_MOVE_DOWN} ${header}`}
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
            'flex min-w-0 flex-wrap items-center gap-0.5',
            compact ? 'px-0.5 py-0.5' : 'px-1 py-0.5'
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** QA stacked dashboard ribbon — text section headers, portal tooltips. */
export function CanvasToolbarStaticQa({
  visibleRowIds,
  renderBlock,
  compact,
}: CanvasToolbarStaticQaProps) {
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
      room: false,
      patron: false,
      vendor: false,
      tools: false,
    })
  }, [])

  if (displayOrder.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center justify-end">
        <TooltipWrapperQa text={QA_TIP_RESET_LAYOUT}>
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
        </TooltipWrapperQa>
      </div>
      {displayOrder.map((rowId, index) => {
        const blockIds = STATIC_ROW_BLOCKS[rowId]
        const expanded = !collapsed[rowId]
        return (
          <StaticToolbarRow
            key={rowId}
            rowId={rowId}
            header={QA_ACCORDION_HEADERS[rowId]}
            index={index}
            total={displayOrder.length}
            expanded={expanded}
            compact={compact}
            onToggle={handleToggle}
            onMove={handleMove}
          >
            {blockIds.map((blockId) => (
              <div
                key={blockId}
                className={cn(
                  'flex w-full min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-md border border-stone-200/90 bg-white px-0.5 shadow-sm',
                  compact ? 'py-0.5' : 'py-0.5'
                )}
              >
                {renderBlock(blockId)}
              </div>
            ))}
          </StaticToolbarRow>
        )
      })}
    </div>
  )
}
