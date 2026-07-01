'use client'

import type { ReactNode } from 'react'
import {
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  return (
    <FloorPlanViewportLayoutProvider>
      <DashboardLedgerViewportGuardInner>{children}</DashboardLedgerViewportGuardInner>
    </FloorPlanViewportLayoutProvider>
  )
}

function DashboardLedgerViewportGuardInner({ children }: { children: ReactNode }) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()

  if (showDesktopRequired) {
    return (
      <div
        className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50"
        role="alert"
        aria-live="polite"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center shadow-xl">
          <p className="font-heading text-xl font-bold tracking-tight">
            Floor plan matrix needs desktop space
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>
          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-3 text-xs text-stone-400">
            Minimum viewport: 1024px wide and 550px tall. Open Presenter or Wall Cast on a
            landscape tablet, laptop, or desktop monitor.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
