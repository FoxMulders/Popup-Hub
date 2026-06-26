'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size (1024px wide by 550px tall).'

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
}

interface ViewportSize {
  width: number
  height: number
}

function currentViewportSize(): ViewportSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function useMeasuredViewportSize(): ViewportSize | null {
  const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null)

  useEffect(() => {
    const sync = () => setViewportSize(currentViewportSize())
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return viewportSize
}

export function FloorPlanMatrixSmallScreenWarning({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-full flex-1 items-center justify-center p-4 text-center sm:p-6',
        className
      )}
      role="alert"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="max-w-lg rounded-2xl border border-amber-300/80 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <p className="font-heading text-lg font-semibold tracking-tight">
          Floor plan matrix needs a larger screen
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-3 text-xs font-medium text-amber-900/85">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}

function LedgerViewportMeasuringState() {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center p-4 text-center text-sm text-stone-600"
      role="status"
    >
      Checking display size…
    </div>
  )
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: DashboardLedgerViewportGuardProps) {
  const viewportSize = useMeasuredViewportSize()
  const isPocketSized = viewportSize
    ? isPocketSizedViewport(viewportSize.width, viewportSize.height)
    : null

  return (
    <div className={cn('min-h-0', className)}>
      {isPocketSized === null ? (
        <LedgerViewportMeasuringState />
      ) : isPocketSized ? (
        <FloorPlanMatrixSmallScreenWarning />
      ) : (
        children
      )}
    </div>
  )
}
