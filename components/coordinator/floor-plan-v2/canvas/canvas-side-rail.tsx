'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Body width for canvas legend / ledger side rails — keep both panels in sync. */
export const CANVAS_SIDE_PANEL_BODY_PX = 200

/** Chevron tab width (`w-7`). */
export const CANVAS_SIDE_PANEL_TAB_PX = 28

export const CANVAS_SIDE_PANEL_EXPANDED_PX =
  CANVAS_SIDE_PANEL_BODY_PX + CANVAS_SIDE_PANEL_TAB_PX

export interface CanvasSideRailProps {
  side: 'left' | 'right'
  collapsed: boolean
  onCollapsedChange: (next: boolean) => void
  title: string
  ariaLabel: string
  expandTitle: string
  collapseTitle: string
  panelClassName?: string
  className?: string
  children: React.ReactNode
}

export function CanvasSideRail({
  side,
  collapsed,
  onCollapsedChange,
  title,
  ariaLabel,
  expandTitle,
  collapseTitle,
  panelClassName,
  className,
  children,
}: CanvasSideRailProps) {
  const isLeft = side === 'left'
  const railWidth = collapsed
    ? CANVAS_SIDE_PANEL_TAB_PX
    : CANVAS_SIDE_PANEL_EXPANDED_PX
  const slideOffset = collapsed
    ? -CANVAS_SIDE_PANEL_BODY_PX
    : 0

  const tab = (
    <button
      type="button"
      onClick={() => onCollapsedChange(!collapsed)}
      title={collapsed ? expandTitle : collapseTitle}
      aria-label={collapsed ? expandTitle : collapseTitle}
      aria-expanded={!collapsed}
      className={cn(
        'canvas-side-rail__tab pointer-events-auto inline-flex h-full w-7 shrink-0 flex-col items-center justify-center gap-1 border-stone-200/90 bg-white/95 text-stone-500 shadow-[4px_0_12px_rgb(28_25_23_/_0.08)] backdrop-blur-sm hover:bg-white hover:text-stone-700',
        isLeft
          ? 'rounded-r-md border border-l-0'
          : 'rounded-l-md border border-r-0 shadow-[-4px_0_12px_rgb(28_25_23_/_0.08)]'
      )}
    >
      {isLeft ? (
        collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        )
      ) : collapsed ? (
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  )

  const panel = (
    <div
      className={cn(
        'canvas-side-rail__body pointer-events-auto flex h-full min-h-0 shrink-0 flex-col border-stone-200/90 bg-white/95 p-2 backdrop-blur-sm',
        isLeft
          ? 'border-r shadow-[4px_0_16px_rgb(28_25_23_/_0.08)]'
          : 'border-l shadow-[-4px_0_16px_rgb(28_25_23_/_0.08)]',
        panelClassName
      )}
      style={{ width: CANVAS_SIDE_PANEL_BODY_PX }}
    >
      <div className="mb-1 shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-stone-500">
          {title}
        </span>
      </div>
      {children}
    </div>
  )

  return (
    <div
      className={cn(
        'canvas-side-rail flex h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
        isLeft ? 'canvas-side-rail--left' : 'canvas-side-rail--right',
        className
      )}
      style={{ width: railWidth }}
      role="region"
      aria-label={ariaLabel}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(${slideOffset}px)` }}
      >
        {isLeft ? (
          <>
            {panel}
            {tab}
          </>
        ) : (
          <>
            {panel}
            {tab}
          </>
        )}
      </div>
    </div>
  )
}
