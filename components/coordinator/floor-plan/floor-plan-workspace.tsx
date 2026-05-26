'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { FloorPlanSidebar } from '@/components/coordinator/floor-plan/floor-plan-sidebar'
import { cn } from '@/lib/utils'

export interface FloorPlanWorkspaceProps {
  leftSidebar: ReactNode
  rightSidebar: ReactNode
  alerts?: ReactNode
  canvas: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Returns true while the viewport is below `md` (768 px). Used to default
 * both sidebars to collapsed on phones so the canvas isn't crushed to
 * 0 px wide between two 240 px rails. Re-evaluates on resize so a viewport
 * rotation re-collapses / re-expands appropriately.
 */
function useIsMobileViewport(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [breakpoint])
  return isMobile
}

export function FloorPlanWorkspace({
  leftSidebar,
  rightSidebar,
  alerts,
  canvas,
  footer,
  className,
}: FloorPlanWorkspaceProps) {
  const isMobile = useIsMobileViewport()
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // On mobile entry collapse both rails so the canvas claims full width.
  // We only force-collapse on the *transition* to mobile, never on every
  // resize, so users can still expand a rail manually while on a phone.
  useEffect(() => {
    if (isMobile) {
      setLeftCollapsed(true)
      setRightCollapsed(true)
    }
  }, [isMobile])

  return (
    <div className={cn('flex min-h-0 w-full flex-col gap-2', className)}>
      {/*
       * Stack vertically on mobile so the canvas always gets the full
       * viewport width. Above md the workspace returns to the classic
       * three-column layout (left rail · canvas · right rail).
       */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch gap-2 md:flex-row">
        <FloorPlanSidebar
          side="left"
          title="Venue & inventory"
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((v) => !v)}
        >
          {leftSidebar}
        </FloorPlanSidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {alerts}
          <section className="relative flex min-h-[min(60vh,1100px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[var(--shadow-market)] md:min-h-[min(78vh,1100px)]">
            {canvas}
          </section>
          {footer}
        </div>

        <FloorPlanSidebar
          side="right"
          title="Stats & presets"
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed((v) => !v)}
        >
          {rightSidebar}
        </FloorPlanSidebar>
      </div>
    </div>
  )
}
