'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Use a desktop-sized display to review or present booth assignments.'

const SERVER_VIEWPORT_SNAPSHOT = 'server'

function subscribeViewportChanges(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  window.addEventListener('orientationchange', onStoreChange)
  return () => {
    window.removeEventListener('resize', onStoreChange)
    window.removeEventListener('orientationchange', onStoreChange)
  }
}

function getViewportSnapshot() {
  if (typeof window === 'undefined') return SERVER_VIEWPORT_SNAPSHOT
  return `${window.innerWidth}x${window.innerHeight}`
}

function getServerViewportSnapshot() {
  return SERVER_VIEWPORT_SNAPSHOT
}

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const viewportSnapshot = useSyncExternalStore(
    subscribeViewportChanges,
    getViewportSnapshot,
    getServerViewportSnapshot
  )

  if (viewportSnapshot === SERVER_VIEWPORT_SNAPSHOT) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-stone-50 p-6 text-sm text-stone-600">
        Checking screen size…
      </div>
    )
  }

  const [width, height] = viewportSnapshot.split('x').map(Number)

  if (isPocketSizedViewport(width, height)) {
    return (
      <div
        className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-6 text-stone-50"
        role="alert"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Booth Matrix needs a larger screen
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>
          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-4 text-sm text-stone-400">
            Recommended layout desktop size: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide
            and {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
