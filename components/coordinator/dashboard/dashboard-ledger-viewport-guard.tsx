'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
}

interface ViewportDimensions {
  width: number
  height: number
}

function useMeasuredViewportDimensions(): ViewportDimensions | null {
  const [dimensions, setDimensions] = useState<ViewportDimensions | null>(null)

  useEffect(() => {
    const sync = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return dimensions
}

export function DashboardLedgerViewportGuard({
  children,
}: DashboardLedgerViewportGuardProps) {
  const dimensions = useMeasuredViewportDimensions()

  if (!dimensions) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-stone-50 p-6 text-sm text-stone-600">
        Loading booth matrix…
      </div>
    )
  }

  if (isPocketSizedViewport(dimensions.width, dimensions.height)) {
    return <FloorPlanMatrixSmallScreenWarning />
  }

  return <>{children}</>
}

function FloorPlanMatrixSmallScreenWarning() {
  return (
    <main className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-6 text-stone-50">
      <section
        className="w-full max-w-lg rounded-2xl border border-amber-300/40 bg-stone-900 p-6 text-center shadow-2xl"
        role="status"
        aria-live="polite"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
          Desktop layout recommended
        </p>
        <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight">
          Booth Matrix unavailable on this screen
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/70 px-4 py-3 text-xs text-stone-400">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </section>
    </main>
  )
}
