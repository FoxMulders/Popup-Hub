'use client'

import type { ReactNode } from 'react'
import {
  DesktopScreenRequiredOverlay,
  FLOOR_PLAN_DESKTOP_SIZE_BREAKER,
  FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING,
  FloorPlanViewportLayoutProvider,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  return (
    <FloorPlanViewportLayoutProvider>
      <DesktopScreenRequiredOverlay
        title="Booth matrix needs a larger screen"
        description={FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        requirement={FLOOR_PLAN_DESKTOP_SIZE_BREAKER}
        exitLabel="Back to HubGrid"
      />
      {children}
    </FloorPlanViewportLayoutProvider>
  )
}
