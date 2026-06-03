'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { CANVAS_FULLSCREEN_CLASS } from '@/components/coordinator/floor-plan-v2/canvas/use-native-fullscreen'

const COMMAND_CENTER_FULLSCREEN_CLASS = 'command-center-canvas-fullscreen'

/** Strip immersive canvas classes so site nav stays visible after route changes. */
export function useCoordinatorRouteChromeCleanup(): void {
  const pathname = usePathname() ?? ''

  useEffect(() => {
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    document.documentElement.classList.remove(COMMAND_CENTER_FULLSCREEN_CLASS)
    delete document.body.dataset.dashboardCommandCenter
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [pathname])
}
