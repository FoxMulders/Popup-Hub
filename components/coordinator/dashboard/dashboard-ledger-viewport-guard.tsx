'use client'

import type { ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import { useIsPocketSizedViewport } from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
}

/** Standalone matrix windows are dense operational views and need the desktop breaker. */
export function DashboardLedgerViewportGuard({
  children,
}: DashboardLedgerViewportGuardProps) {
  const isPocketSized = useIsPocketSizedViewport()

  if (!isPocketSized) return children

  return (
    <div
      className="flex h-screen min-h-0 items-center justify-center bg-stone-950 p-4 text-stone-50"
      role="status"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Booth Matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 text-xs text-stone-500">
          Open the presenter or wall-cast matrix from HubGrid on a desktop-sized display.
        </p>
      </div>
    </div>
  )
}
