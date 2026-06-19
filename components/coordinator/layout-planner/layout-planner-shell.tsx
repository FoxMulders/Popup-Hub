'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLayoutCanvasViewportLock } from './use-layout-canvas-viewport-lock'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

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
  desktopRequiredExitHref?: string
  desktopRequiredExitLabel?: string
}

/**
 * Full-viewport layout planner shell — canvas is hero, no page scroll.
 * Top status strip + optional left rail | canvas | inspector (via FloorPlanV2).
 */
export function LayoutPlannerShell({
  desktopRequiredExitHref,
  desktopRequiredExitLabel,
  ...props
}: LayoutPlannerShellProps) {
  return (
    <FloorPlanViewportLayoutProvider>
      <LayoutPlannerShellInner
        {...props}
        desktopRequiredExitHref={desktopRequiredExitHref}
        desktopRequiredExitLabel={desktopRequiredExitLabel}
      />
    </FloorPlanViewportLayoutProvider>
  )
}

function LayoutPlannerShellInner({
  mode,
  header,
  leftRail,
  stats,
  children,
  footer,
  className,
  desktopRequiredExitHref,
  desktopRequiredExitLabel,
}: LayoutPlannerShellProps) {
  useLayoutCanvasViewportLock(true)
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const showSideRail = Boolean(leftRail || stats)

  return (
    <div
      className={cn(
        'layout-planner-root flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas',
        mode === 'wizard' && 'wizard-layout-planner-root',
        className
      )}
    >
      <DesktopScreenRequiredOverlay
        exitHref={desktopRequiredExitHref}
        exitLabel={desktopRequiredExitLabel}
      />
      {header}

      {showSideRail && leftRail ? (
        <div className="shrink-0 border-b border-stone-200/70 bg-card/50 px-2 py-2 lg:hidden">
          {leftRail}
        </div>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 flex-1 basis-0 overflow-hidden',
          showSideRail
            ? 'grid-cols-1 lg:grid-cols-[var(--layout-planner-left,240px)_minmax(0,1fr)]'
            : 'grid-cols-1'
        )}
      >
        {showSideRail ? (
          <aside
            className="hidden min-h-0 min-w-0 flex-col lg:flex lg:border-r lg:border-stone-200/70"
            aria-label="Rooms and layout stats"
          >
            {leftRail ? (
              <div className="layout-planner-left-rail min-h-0 flex-1 overflow-y-auto overflow-x-visible p-3">
                {leftRail}
              </div>
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
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          aria-label="Floor plan canvas"
        >
          {showDesktopRequired ? (
            <div
              className="flex h-full min-h-[40vh] items-center justify-center p-6 text-center"
              aria-hidden
            />
          ) : (
            children
          )}
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
