'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useIsPocketSizedViewport } from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const isPocketSized = useIsPocketSizedViewport()

  if (!isPocketSized) {
    return <>{children}</>
  }

  return (
    <div
      className="flex h-full min-h-screen items-center justify-center bg-stone-950 px-4 py-8 text-stone-50"
      role="alert"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-stone-900 p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 font-heading text-xl font-semibold tracking-tight">
          Booth matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-stone-400">
          Open HubGrid on a viewport at least 1024px wide and 550px tall to use the
          presenter or wall-cast matrix.
        </p>
      </div>
    </div>
  )
}
