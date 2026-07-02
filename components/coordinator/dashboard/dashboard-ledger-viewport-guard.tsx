'use client'

import type { ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import { useIsPocketSizedViewport } from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
}

export function DashboardLedgerViewportGuard({
  children,
  className,
}: DashboardLedgerViewportGuardProps) {
  const showSmallScreenWarning = useIsPocketSizedViewport()

  if (!showSmallScreenWarning) return <>{children}</>

  return (
    <div
      className={cn(
        'flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Booth matrix needs a desktop layout
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
      </div>
    </div>
  )
}
