'use client'

import { type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
  useFloorPlanViewportDimensions,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export function shouldShowFloorPlanMatrixSmallScreenWarning(
  width: number,
  height: number
): boolean {
  return isPocketSizedViewport(width, height)
}

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const { width, height } = useFloorPlanViewportDimensions()

  if (shouldShowFloorPlanMatrixSmallScreenWarning(width, height)) {
    return (
      <div
        className="flex h-full min-h-screen items-center justify-center bg-stone-950 px-4 py-8 text-stone-50"
        data-testid="floor-plan-matrix-small-screen-warning"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Booth Matrix needs a larger screen
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>
          <div className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-4 text-sm text-stone-400">
            Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
            {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
          </div>
          <a
            href="/coordinator/studio"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
          >
            Open HubGrid on desktop
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
