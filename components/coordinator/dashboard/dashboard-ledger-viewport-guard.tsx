'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Use the recommended desktop layout breakpoint before reviewing booth assignments.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const [showSmallScreenWarning, setShowSmallScreenWarning] = useState<boolean | null>(null)

  useEffect(() => {
    const sync = () => {
      setShowSmallScreenWarning(isPocketSizedViewport(window.innerWidth, window.innerHeight))
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  if (showSmallScreenWarning === false) return <>{children}</>

  if (showSmallScreenWarning === null) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-sm text-stone-300">
        Checking Booth Matrix viewport...
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50"
      role="alert"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-300/50 bg-stone-900 p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          Booth Matrix needs a larger screen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-3 text-sm text-stone-300">
          Recommended layout: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}
