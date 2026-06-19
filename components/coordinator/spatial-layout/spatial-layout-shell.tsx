'use client'

import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLayoutCanvasViewportLock } from '@/components/coordinator/layout-planner/use-layout-canvas-viewport-lock'
import { CANVAS_FULLSCREEN_CLASS } from '@/components/coordinator/floor-plan-v2/canvas/use-native-fullscreen'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

const COMMAND_CENTER_FULLSCREEN_CLASS = 'command-center-canvas-fullscreen'

export interface SpatialLayoutShellProps {
  toolbar: ReactNode
  children: ReactNode
  className?: string
  desktopRequiredExitHref?: string
  desktopRequiredExitLabel?: string
}

/** Full-viewport editor — canvas is the hero; document scroll is locked. */
export function SpatialLayoutShell({
  desktopRequiredExitHref,
  desktopRequiredExitLabel,
  ...props
}: SpatialLayoutShellProps) {
  return (
    <FloorPlanViewportLayoutProvider>
      <SpatialLayoutShellInner
        {...props}
        desktopRequiredExitHref={desktopRequiredExitHref}
        desktopRequiredExitLabel={desktopRequiredExitLabel}
      />
    </FloorPlanViewportLayoutProvider>
  )
}

function SpatialLayoutShellInner({
  toolbar,
  children,
  className,
  desktopRequiredExitHref,
  desktopRequiredExitLabel,
}: SpatialLayoutShellProps) {
  useLayoutCanvasViewportLock(true)
  const { showDesktopRequired } = useFloorPlanViewportLayout()

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
      document.documentElement.classList.remove(COMMAND_CENTER_FULLSCREEN_CLASS)
      delete document.body.dataset.dashboardCommandCenter
    }
  }, [])

  return (
    <div
      className={cn(
        'layout-planner-root spatial-layout-root flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas',
        className
      )}
    >
      <DesktopScreenRequiredOverlay
        exitHref={desktopRequiredExitHref}
        exitLabel={desktopRequiredExitLabel}
      />
      {toolbar}
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
  )
}
