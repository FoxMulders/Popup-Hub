'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface LayoutPlannerShellQaProps {
  mode: 'wizard' | 'standalone'
  header: ReactNode
  /** Room switcher — shown in left rail (desktop) and above canvas (mobile). */
  leftRail?: ReactNode
  /** Compact stats below the room list on desktop. */
  stats?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * QA layout planner shell — document scroll only (no viewport lock, no nested overflow).
 */
export function LayoutPlannerShellQa({
  mode,
  header,
  leftRail,
  stats,
  children,
  footer,
  className,
}: LayoutPlannerShellQaProps) {
  const showSideRail = Boolean(leftRail || stats)

  return (
    <div
      className={cn(
        'layout-planner-root layout-planner-root-qa flex w-full flex-1 flex-col bg-canvas',
        mode === 'wizard' && 'wizard-layout-planner-root',
        className
      )}
    >
      {header}

      {showSideRail && leftRail ? (
        <div className="shrink-0 border-b border-stone-200/70 bg-card/50 px-2 py-2 lg:hidden">
          {leftRail}
        </div>
      ) : null}

      <div
        className={cn(
          'grid w-full flex-1',
          showSideRail
            ? 'grid-cols-1 lg:grid-cols-[var(--layout-planner-left,240px)_minmax(0,1fr)]'
            : 'grid-cols-1'
        )}
      >
        {showSideRail ? (
          <aside
            className="hidden min-w-0 flex-col lg:flex lg:border-r lg:border-stone-200/70"
            aria-label="Rooms and layout stats"
          >
            {leftRail ? (
              <div className="layout-planner-left-rail overflow-x-visible p-3">{leftRail}</div>
            ) : null}
            {stats ? (
              <div className="shrink-0 border-t border-stone-200/70 p-3">{stats}</div>
            ) : null}
            <div
              id="layout-planner-debug-slot"
              className="shrink-0 border-t border-stone-200/70 p-2 empty:hidden"
              aria-label="Section 2 diagnostic log mount"
            />
          </aside>
        ) : null}

        <main
          className="relative flex min-w-0 flex-1 flex-col"
          aria-label="Floor plan canvas"
        >
          {children}
        </main>
      </div>

      {footer ? (
        <footer
          className={cn(
            'shrink-0 border-t border-stone-200/70 bg-card/60',
            mode === 'wizard' && 'py-1'
          )}
        >
          {footer}
        </footer>
      ) : null}
    </div>
  )
}
