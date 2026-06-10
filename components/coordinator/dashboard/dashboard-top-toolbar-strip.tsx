'use client'

import { cn } from '@/lib/utils'
import { DashboardToolbarPortalTarget } from './dashboard-toolbar-portal'

export interface DashboardTopToolbarStripProps {
  className?: string
  /** Hide toolbar controls while previewing the floor plan. */
  hidden?: boolean
}

/**
 * Horizontal layout-tools host — sits directly below the dashboard header.
 * FloorPlanV2 portals CanvasCommandBar blocks here on all viewports.
 */
export function DashboardTopToolbarStrip({
  className,
  hidden = false,
}: DashboardTopToolbarStripProps) {
  if (hidden) return null

  return (
    <div
      className={cn(
        'dashboard-top-toolbar-strip shrink-0 border-b border-stone-200/80 bg-card/95 backdrop-blur-sm',
        className
      )}
    >
      <DashboardToolbarPortalTarget
        className={cn(
          'dashboard-toolbar-portal flex min-h-0 w-full min-w-0 flex-row flex-nowrap items-stretch gap-[var(--dashboard-panel-gap)] overflow-x-auto py-1',
          'border-b-0 bg-transparent empty:hidden'
        )}
      />
    </div>
  )
}
