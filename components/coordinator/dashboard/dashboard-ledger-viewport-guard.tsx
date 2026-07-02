'use client'

import type { ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
} from '@/hooks/use-floor-plan-viewport-tier'

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
        className="flex h-screen min-h-[100dvh] items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6"
        role="alert"
        aria-labelledby="floor-plan-matrix-small-screen-title"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 text-left shadow-xl sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>

          <h1
            id="floor-plan-matrix-small-screen-title"
            className="font-heading text-xl font-bold tracking-tight text-stone-50 sm:text-2xl"
          >
            Booth matrix needs a desktop layout
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>

          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
            Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
            {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall. Reopen Presenter or Wall Cast on a
            larger display so the live booth assignment matrix stays readable.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
