'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Open Blueprint Studio on a desktop-sized layout viewport before reviewing assignments.'

const FLOOR_PLAN_MATRIX_DESKTOP_BREAKER_COPY = `Recommended layout desktop size: at least ${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide x ${FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.`

interface DashboardLedgerViewportGuardProps {
  children: ReactNode
  className?: string
  variant?: 'embedded' | 'window'
}

/**
 * Blocks matrix-only views until the live viewport matches the Blueprint Studio
 * desktop breaker. This catches resized desktop windows that bypass UA redirects.
 */
export function DashboardLedgerViewportGuard({
  children,
  className,
  variant = 'window',
}: DashboardLedgerViewportGuardProps) {
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(
    null
  )

  useEffect(() => {
    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    window.addEventListener('orientationchange', syncViewport)
    return () => {
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('orientationchange', syncViewport)
    }
  }, [])

  if (!viewport) {
    return (
      <div
        className={cn(
          'flex min-h-0 flex-1 items-center justify-center bg-stone-50 p-6 text-sm text-stone-600',
          variant === 'window' && 'h-screen',
          className
        )}
        role="status"
      >
        Checking display size...
      </div>
    )
  }

  if (!isPocketSizedViewport(viewport.width, viewport.height)) {
    return <>{children}</>
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6',
        variant === 'window' && 'h-screen',
        className
      )}
      role="alert"
      aria-live="assertive"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-stone-50 sm:text-2xl">
          Booth Matrix needs more room
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
          {FLOOR_PLAN_MATRIX_DESKTOP_BREAKER_COPY}
        </p>
      </div>
    </div>
  )
}
