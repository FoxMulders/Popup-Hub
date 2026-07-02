'use client'

import { Monitor } from 'lucide-react'
import { type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
  useFloorPlanViewportDimensions,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const { width, height } = useFloorPlanViewportDimensions()

  if (!isPocketSizedViewport(width, height)) {
    return <>{children}</>
  }

  return (
    <div
      className="flex h-screen min-h-0 items-center justify-center bg-stone-950 p-5 text-stone-50"
      role="status"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-stone-900 p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight">
          Booth Matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/70 p-3 text-xs text-stone-400">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}
