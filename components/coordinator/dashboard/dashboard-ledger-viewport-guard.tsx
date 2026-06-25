'use client'

import type { ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  useIsPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Use a desktop-sized layout to review booth assignments.'

export interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: DashboardLedgerViewportGuardProps) {
  const showDesktopRequired = useIsPocketSizedViewport()

  if (!showDesktopRequired) return <>{children}</>

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col items-center justify-center bg-stone-950 p-6 text-center text-stone-50',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-stone-900 p-6 shadow-xl">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight">
          Floor plan matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/70 px-4 py-3 text-sm text-stone-400">
          Recommended desktop breakpoint: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide by{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}
