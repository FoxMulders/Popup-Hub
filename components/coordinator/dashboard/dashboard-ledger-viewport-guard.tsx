'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Open this booth matrix on a desktop-size display to review assignments safely.'

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
}

interface ViewportSize {
  width: number
  height: number
}

export function DashboardLedgerViewportGuard({
  children,
}: DashboardLedgerViewportGuardProps) {
  const [viewport, setViewport] = useState<ViewportSize | null>(null)

  useEffect(() => {
    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    window.addEventListener('orientationchange', syncViewport)
    return () => {
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('orientationchange', syncViewport)
    }
  }, [])

  if (viewport && !isPocketSizedViewport(viewport.width, viewport.height)) {
    return <>{children}</>
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6">
      <section
        className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 text-left shadow-xl sm:p-8"
        role={viewport ? 'alert' : 'status'}
        aria-busy={viewport ? undefined : true}
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          Floor plan matrix needs a larger screen
        </h1>
        {viewport ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">
              {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
            </p>
            <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
              Recommended layout: desktop-size display, at least{' '}
              {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
              {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            Checking display size before loading the floor plan matrix...
          </p>
        )}
      </section>
    </div>
  )
}
