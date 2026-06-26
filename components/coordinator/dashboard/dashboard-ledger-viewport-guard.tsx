'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens.'

interface ViewportState {
  checked: boolean
  pocketSized: boolean
}

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState<ViewportState>({
    checked: false,
    pocketSized: false,
  })

  useEffect(() => {
    const sync = () => {
      setViewport({
        checked: true,
        pocketSized: isPocketSizedViewport(window.innerWidth, window.innerHeight),
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

  if (!viewport.checked) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-stone-50 p-6 text-center text-sm text-stone-600">
        Checking booth matrix viewport...
      </div>
    )
  }

  if (viewport.pocketSized) {
    return (
      <div
        className="flex h-full min-h-0 items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6"
        role="status"
        aria-live="polite"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Booth Matrix needs a larger screen
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING} Open the matrix on a desktop-sized
            display to mirror HubGrid assignments without clipping columns or controls.
          </p>
          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
            Recommended viewport: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
            {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
          </p>
        </div>
      </div>
    )
  }

  return children
}
