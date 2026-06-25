'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

function subscribeToViewportChanges(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  window.addEventListener('orientationchange', onStoreChange)
  return () => {
    window.removeEventListener('resize', onStoreChange)
    window.removeEventListener('orientationchange', onStoreChange)
  }
}

function getViewportSnapshot() {
  if (typeof window === 'undefined') return null
  return `${window.innerWidth}x${window.innerHeight}`
}

function getServerViewportSnapshot() {
  return null
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const viewportSnapshot = useSyncExternalStore(
    subscribeToViewportChanges,
    getViewportSnapshot,
    getServerViewportSnapshot
  )

  if (!viewportSnapshot) {
    return (
      <div
        className={cn('flex h-full min-h-0 items-center justify-center bg-stone-50', className)}
        aria-busy="true"
      />
    )
  }

  const [width, height] = viewportSnapshot.split('x').map(Number)
  const isPocketSized = isPocketSizedViewport(width ?? 0, height ?? 0)

  if (isPocketSized) {
    return (
      <div
        className={cn(
          'flex h-full min-h-0 items-center justify-center bg-stone-950 p-4 text-stone-50',
          className
        )}
        role="status"
        data-testid="floor-plan-matrix-small-screen-warning"
      >
        <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <Monitor className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-white">
            Booth Matrix needs a desktop-sized display
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
          </p>
          <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/60 p-3 text-sm text-stone-400">
            Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
            {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
