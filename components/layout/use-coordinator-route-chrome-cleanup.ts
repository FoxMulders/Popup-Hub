'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { CANVAS_FULLSCREEN_CLASS } from '@/components/coordinator/floor-plan-v2/canvas/use-native-fullscreen'
import { isCoordinatorStudioPath } from '@/lib/coordinator/coordinator-routes'

const COMMAND_CENTER_FULLSCREEN_CLASS = 'command-center-canvas-fullscreen'

function isCoordinatorStudioRoute(pathname: string): boolean {
  return isCoordinatorStudioPath(pathname)
}

/** Strip immersive canvas classes so site nav stays visible after route changes. */
export function useCoordinatorRouteChromeCleanup(): void {
  const pathname = usePathname() ?? ''

  useEffect(() => {
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    document.documentElement.classList.remove(COMMAND_CENTER_FULLSCREEN_CLASS)

    // CommandCenterFullscreenProvider owns this flag on the studio route.
    if (!isCoordinatorStudioRoute(pathname)) {
      delete document.body.dataset.dashboardCommandCenter
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [pathname])
}
