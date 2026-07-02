'use client'

import { Monitor } from 'lucide-react'
import { type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
} from '@/hooks/use-floor-plan-viewport-tier'
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

  if (!showDesktopRequired) return children

  return (
    <div
      className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6"
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 text-left shadow-xl sm:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Booth matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-4 text-sm text-stone-400">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}
