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
  getStaticRowSegments,
  getVisibleSidebarSections,
  loadStaticRowCollapsed,
  loadStaticRowOrder,
  saveStaticRowCollapsed,
  saveStaticRowOrder,
  STATIC_ROW_HEADERS,
  STATIC_ROW_LABELS,
  type CanvasToolbarStaticRowId,
  type SidebarSectionDef,
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
  /** Left-rail layout designer — split headers and two-column row bodies. */
  sidebarLayout?: boolean
  /** Dashboard top strip — horizontal tool groups with compact gaps. */
  topBarLayout?: boolean
  eventId?: string | null
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-wide text-stone-800">
      {children}
    </h3>
  )
}

function BlockCluster({
  blockIds,
  renderBlock,
  compact,
  className,
  bare,
}: {
  blockIds: readonly CanvasToolbarBlockId[]
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
  className?: string
  bare?: boolean
}) {
  if (bare) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        {blockIds.map((blockId) => (
          <div key={blockId} className="min-w-0">
            {renderBlock(blockId)}
          </div>
        ))}
      </div>
    )
  }

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

function TopBarToolbarSection({
  section,
  renderBlock,
  compact,
  eventId,
}: {
  section: SidebarSectionDef
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
  eventId?: string | null
}) {
  return (
    <section
      className="dashboard-toolbar-section shrink-0 min-w-[min(100%,12rem)]"
      aria-label={section.header}
    >
      <SectionHeader>{section.header}</SectionHeader>
      <div className="flex min-h-[var(--dashboard-toolbar-height)] min-w-0 flex-wrap items-center gap-1.5">
        {section.blocks.map((blockId) => (
          <div
            key={blockId}
            className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-md border border-stone-200/80 bg-stone-50/50 px-0.5 py-0.5"
          >
            {renderBlock(blockId)}
          </div>
        ))}
      </div>
    </section>
  )
}

function SidebarToolbarSection({
  section,
  renderBlock,
  compact,
  eventId,
  isFirst,
}: {
  section: SidebarSectionDef
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
  compact?: boolean
  eventId?: string | null
  isFirst?: boolean
}) {
  return (
    <section
      className={cn(
        'flex w-full min-w-0 shrink-0 flex-col',
        !isFirst && 'border-t border-stone-200/80 pt-4'
      )}
      data-toolbar-section={section.id}
    >
      <SectionHeader>{section.header}</SectionHeader>
      <div className="mt-2 flex w-full min-w-0 flex-col gap-2">
        <BlockCluster
          blockIds={section.blocks}
          renderBlock={renderBlock}
          compact={compact}
          bare
        />
      </div>
    </section>
  )
}

function MergedToolbarRow({
  rowId,
  label,
  leftHeader,
  rightHeader,
  index,
  total,
  expanded,
  compact,
  sidebarLayout,
  showLeft,
  showRight,
  onToggle,
  onMove,
  renderBlock,
}: {
  rowId: CanvasToolbarStaticRowId
  label: string
  leftHeader: string
  rightHeader: string
  index: number
  total: number
  expanded: boolean
  compact?: boolean
  sidebarLayout?: boolean
  showLeft: boolean
  showRight: boolean
  onToggle: (rowId: CanvasToolbarStaticRowId) => void
  onMove: (rowId: CanvasToolbarStaticRowId, direction: -1 | 1) => void
  renderBlock: (id: CanvasToolbarBlockId) => React.ReactNode
}) {
  const segments = getStaticRowSegments(rowId, Boolean(sidebarLayout))
  const singleSegment = showLeft !== showRight
  const splitHeader = sidebarLayout && showLeft && showRight

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
        {splitHeader ? (
          <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-2 px-0.5">
            <SectionHeader>{leftHeader}</SectionHeader>
            <SectionHeader>{rightHeader}</SectionHeader>
          </div>
        ) : (
          <>
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
            {rowId === 'room-tools' && showRight && !sidebarLayout ? (
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
          </>
        )}
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
        sidebarLayout && showLeft && showRight ? (
          <div className="grid min-w-0 grid-cols-2 gap-0">
            <div className="flex min-w-0 flex-col gap-1.5 border-r border-stone-200/90 px-1.5 py-1.5">
              <BlockCluster
                blockIds={segments.left}
                renderBlock={renderBlock}
                compact={compact}
                bare
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 px-1.5 py-1.5">
              <BlockCluster
                blockIds={segments.right}
                renderBlock={renderBlock}
                compact={compact}
                bare
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex min-w-0 flex-col flex-wrap gap-1 md:gap-1.5 lg:flex-nowrap lg:items-center lg:justify-between lg:gap-2 lg:w-full lg:overflow-x-auto',
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
        )
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
  sidebarLayout = false,
  topBarLayout = false,
  eventId,
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

  const sidebarSections = useMemo(
    () => (sidebarLayout || topBarLayout ? getVisibleSidebarSections(segmentCtx) : []),
    [sidebarLayout, topBarLayout, segmentCtx]
  )

  if (topBarLayout) {
    if (sidebarSections.length === 0) return null

    return (
      <div className="flex min-w-0 flex-nowrap items-stretch gap-[var(--dashboard-panel-gap)] overflow-x-auto pb-0.5">
        {sidebarSections.map((section) => (
          <TopBarToolbarSection
            key={section.id}
            section={section}
            renderBlock={renderBlock}
            compact={compact}
            eventId={eventId}
          />
        ))}
      </div>
    )
  }

  if (sidebarLayout) {
    if (sidebarSections.length === 0) return null

    return (
      <div className="flex w-full min-w-0 shrink-0 flex-col">
        <div className="mb-3 flex min-w-0 shrink-0 items-center justify-end">
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
        {sidebarSections.map((section, index) => (
          <SidebarToolbarSection
            key={section.id}
            section={section}
            renderBlock={renderBlock}
            compact={compact}
            eventId={eventId}
            isFirst={index === 0}
          />
        ))}
      </div>
    )
  }

  if (displayOrder.length === 0) return null

  return (
    <div className={cn('flex min-w-0 flex-col', 'gap-1')}>
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
        const headers = STATIC_ROW_HEADERS[rowId]
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
            leftHeader={headers.left}
            rightHeader={headers.right}
            index={index}
            total={displayOrder.length}
            expanded={expanded}
            compact={compact}
            sidebarLayout={sidebarLayout}
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
