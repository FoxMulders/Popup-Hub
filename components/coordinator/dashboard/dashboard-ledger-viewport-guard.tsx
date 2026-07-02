'use client'

import type { ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import { useIsPocketSizedViewport } from '@/hooks/use-floor-plan-viewport-tier'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const showWarning = useIsPocketSizedViewport()

  if (!showWarning) return <>{children}</>

  return (
    <div className="flex h-screen min-h-0 items-center justify-center bg-stone-950 px-4 py-6 text-stone-50">
      <section
        className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center shadow-xl"
        role="alert"
        aria-labelledby="floor-plan-matrix-small-screen-title"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1
          id="floor-plan-matrix-small-screen-title"
          className="font-heading text-xl font-bold tracking-tight text-white"
        >
          Booth matrix needs a larger screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
      </section>
    </div>
  )
}
