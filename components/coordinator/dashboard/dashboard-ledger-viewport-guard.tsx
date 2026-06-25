'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  useIsPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

export interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
  tone?: 'light' | 'dark'
}

/**
 * Blocks standalone matrix windows on phone-sized or short viewports before
 * subscriptions mount, preserving the desktop-first table layout contract.
 */
export function DashboardLedgerViewportGuard({
  children,
  className,
  tone = 'light',
}: DashboardLedgerViewportGuardProps) {
  const pocketSized = useIsPocketSizedViewport()
  const [viewportMeasured, setViewportMeasured] = useState(false)

  useEffect(() => {
    setViewportMeasured(true)
  }, [])

  if (!viewportMeasured) {
    return (
      <div
        className={cn(
          'flex h-full min-h-screen items-center justify-center p-4 text-center',
          tone === 'dark'
            ? 'bg-stone-950 text-stone-400'
            : 'bg-stone-50 text-stone-600',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium">Checking booth matrix viewport…</p>
      </div>
    )
  }

  if (!pocketSized) {
    return <>{children}</>
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-screen items-center justify-center p-4 text-center',
        tone === 'dark'
          ? 'bg-stone-950 text-stone-50'
          : 'bg-stone-50 text-stone-950',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-2xl border p-6 shadow-xl sm:p-8',
          tone === 'dark'
            ? 'border-stone-700 bg-stone-900'
            : 'border-stone-200 bg-white'
        )}
      >
        <div
          className={cn(
            'mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl',
            tone === 'dark'
              ? 'bg-emerald-400/15 text-emerald-200'
              : 'bg-emerald-50 text-emerald-700'
          )}
        >
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          Booth Matrix needs a larger screen
        </h1>
        <p
          className={cn(
            'mt-2 text-sm leading-relaxed',
            tone === 'dark' ? 'text-stone-300' : 'text-stone-600'
          )}
        >
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-sm',
            tone === 'dark'
              ? 'border-stone-700 bg-stone-800/60 text-stone-300'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          )}
        >
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}
