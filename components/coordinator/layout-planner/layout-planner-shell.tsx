'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface LayoutPlannerShellProps {
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
 * Full-viewport layout planner shell — canvas is hero, no page scroll.
 * Top status strip + optional left rail | canvas | inspector (via FloorPlanV2).
 */
export function LayoutPlannerShell({
  mode,
  header,
  leftRail,
  stats,
  children,
  footer,
  className,
}: LayoutPlannerShellProps) {
  const showSideRail = Boolean(leftRail || stats)

  return (
    <div
      className={cn(
        'layout-planner-root flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas',
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
          'grid min-h-0 flex-1 overflow-hidden',
          showSideRail
            ? 'grid-cols-1 lg:grid-cols-[var(--layout-planner-left,240px)_minmax(0,1fr)]'
            : 'grid-cols-1'
        )}
      >
        {showSideRail ? (
          <aside
            className="hidden min-h-0 flex-col overflow-hidden border-stone-200/70 lg:flex lg:border-r"
            aria-label="Rooms and layout stats"
          >
            {leftRail ? (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">{leftRail}</div>
            ) : null}
            {stats ? (
              <div className="shrink-0 border-t border-stone-200/70 p-3">{stats}</div>
            ) : null}
          </aside>
        ) : null}

        <main
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          aria-label="Floor plan canvas"
        >
          {children}
        </main>
      </div>

      {footer ? <footer className="shrink-0 border-t border-stone-200/70 bg-card/60">{footer}</footer> : null}
    </div>
  )
}
