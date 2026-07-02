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
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

interface DashboardLedgerSmallScreenWarningProps {
  className?: string
}

export function DashboardLedgerSmallScreenWarning({
  className,
}: DashboardLedgerSmallScreenWarningProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[16rem] items-center justify-center bg-stone-50 p-4 text-center text-stone-900',
        className
      )}
      role="alert"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
          <Monitor className="h-5 w-5" aria-hidden />
        </div>
        <p className="font-heading text-lg font-semibold text-amber-950">
          Booth matrix needs more room
        </p>
        <p className="mt-2 text-sm font-medium text-amber-950">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-3 text-xs text-amber-900/85">
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: DashboardLedgerViewportGuardProps) {
  const showWarning = useIsPocketSizedViewport()

  if (showWarning) {
    return <DashboardLedgerSmallScreenWarning className={className} />
  }

  return <>{children}</>
}
