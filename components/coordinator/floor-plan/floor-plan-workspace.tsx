'use client'

import { useState, type ReactNode } from 'react'
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

export function FloorPlanWorkspace({
  leftSidebar,
  rightSidebar,
  alerts,
  canvas,
  footer,
  className,
}: FloorPlanWorkspaceProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  return (
    <div className={cn('flex min-h-0 w-full flex-col gap-2', className)}>
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-2">
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
          <section className="relative flex min-h-[min(78vh,1100px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[var(--shadow-market)]">
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
