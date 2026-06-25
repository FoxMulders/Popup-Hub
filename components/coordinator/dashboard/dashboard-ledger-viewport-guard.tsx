'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
  type FloorPlanViewportDimensions,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens.'

export function DashboardLedgerViewportGuard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const dimensions = useMeasuredViewportDimensions()

  if (!dimensions) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[16rem] items-center justify-center bg-stone-50 p-6 text-center text-sm text-stone-600',
          className
        )}
        role="status"
      >
        Checking floor plan matrix display size...
      </div>
    )
  }

  if (isPocketSizedViewport(dimensions.width, dimensions.height)) {
    return <FloorPlanMatrixSmallScreenWarning className={className} />
  }

  return <>{children}</>
}

export function FloorPlanMatrixSmallScreenWarning({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[16rem] items-center justify-center bg-stone-950/95 p-4 text-stone-50 sm:p-6',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl">
        <p className="font-heading text-xl font-bold tracking-tight">
          Booth Matrix needs a larger screen
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING} Open this view on a desktop-size
          layout before reviewing assignments, payments, or presenter sync.
        </p>
        <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-medium text-amber-100">
          Recommended layout breaker: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}

function useMeasuredViewportDimensions(): FloorPlanViewportDimensions | null {
  const [dimensions, setDimensions] = useState<FloorPlanViewportDimensions | null>(null)

  useEffect(() => {
    const sync = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
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
