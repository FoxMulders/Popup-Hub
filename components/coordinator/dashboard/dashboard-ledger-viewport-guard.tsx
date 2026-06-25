'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
  useFloorPlanViewportDimensions,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size or larger.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const { width, height } = useFloorPlanViewportDimensions()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className="flex h-full min-h-0 items-center justify-center bg-stone-950 text-stone-50"
        aria-hidden
      />
    )
  }

  if (!isPocketSizedViewport(width, height)) return <>{children}</>

  return (
    <div
      className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-stone-950 p-4 text-stone-50 sm:p-6"
      role="alert"
      aria-labelledby="floor-plan-matrix-small-screen-title"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-300/40 bg-stone-900 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          Desktop layout required
        </p>
        <h1
          id="floor-plan-matrix-small-screen-title"
          className="mt-3 font-heading text-2xl font-bold tracking-tight text-white"
        >
          Floor plan matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-4 text-sm text-stone-300">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall. Open Presenter or Wall Cast from a desktop
          browser or landscape tablet display.
        </p>
      </div>
    </div>
  )
}
