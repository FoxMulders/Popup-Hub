'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

const PENDING_VIEWPORT = 'pending'

function subscribeViewport(callback: () => void) {
  window.addEventListener('resize', callback)
  window.addEventListener('orientationchange', callback)
  return () => {
    window.removeEventListener('resize', callback)
    window.removeEventListener('orientationchange', callback)
  }
}

function getViewportSnapshot() {
  if (typeof window === 'undefined') return PENDING_VIEWPORT
  return `${window.innerWidth}:${window.innerHeight}`
}

function getServerViewportSnapshot() {
  return PENDING_VIEWPORT
}

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const viewport = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    getServerViewportSnapshot
  )

  if (viewport === PENDING_VIEWPORT) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-sm text-stone-600">
        Loading booth matrix…
      </div>
    )
  }

  const [width, height] = viewport.split(':').map(Number) as [number, number]

  if (isPocketSizedViewport(width, height)) {
    return (
      <main
        className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <section
          className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8"
          role="alert"
          aria-labelledby="floor-plan-matrix-small-screen-title"
        >
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>
          <h1
            id="floor-plan-matrix-small-screen-title"
            className="font-heading text-xl font-bold tracking-tight sm:text-2xl"
          >
            Booth Matrix needs a larger screen
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>
          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
            Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
            {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
          </p>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
