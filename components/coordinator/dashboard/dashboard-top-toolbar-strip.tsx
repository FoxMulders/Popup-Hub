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
          'flex min-h-0 w-full min-w-0 flex-row flex-wrap items-stretch gap-2 overflow-x-auto px-2 py-1.5 sm:px-3',
          'border-b-0 bg-transparent empty:hidden'
        )}
      />
    </div>
  )
}
