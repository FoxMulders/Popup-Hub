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
  'The floor plan matrix is not optimized for small screens.'

function subscribeToViewportChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('resize', onStoreChange)
  window.addEventListener('orientationchange', onStoreChange)
  return () => {
    window.removeEventListener('resize', onStoreChange)
    window.removeEventListener('orientationchange', onStoreChange)
  }
}

function getViewportBlockedSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return isPocketSizedViewport(window.innerWidth, window.innerHeight)
}

function getServerViewportBlockedSnapshot(): boolean {
  return false
}

export function useFloorPlanMatrixSmallScreen(): boolean {
  return useSyncExternalStore(
    subscribeToViewportChanges,
    getViewportBlockedSnapshot,
    getServerViewportBlockedSnapshot
  )
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const smallScreen = useFloorPlanMatrixSmallScreen()

  if (!smallScreen) return <>{children}</>

  return (
    <section
      className={cn(
        'flex h-full min-h-[320px] flex-1 items-center justify-center bg-stone-50 p-4 text-center sm:p-6',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold tracking-tight">
          Booth Matrix needs a larger screen
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING} Open HubGrid on a desktop-sized
          viewport before reviewing or editing booth assignments.
        </p>
        <p className="mt-4 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs font-medium text-amber-900">
          Recommended layout desktop size: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px
          wide by {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </section>
  )
}
