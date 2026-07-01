'use client'

import { Monitor } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

const UNKNOWN_VIEWPORT = 'unknown'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout desktop size: at least 1024px wide by 550px tall.'

function viewportSnapshot(): string {
  if (typeof window === 'undefined') return UNKNOWN_VIEWPORT
  const viewport = window.visualViewport
  const width = Math.round(viewport?.width ?? window.innerWidth)
  const height = Math.round(viewport?.height ?? window.innerHeight)
  return `${width}x${height}`
}

function serverViewportSnapshot(): string {
  return UNKNOWN_VIEWPORT
}

function subscribeViewport(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const viewport = window.visualViewport

  window.addEventListener('resize', listener)
  window.addEventListener('orientationchange', listener)
  viewport?.addEventListener('resize', listener)

  return () => {
    window.removeEventListener('resize', listener)
    window.removeEventListener('orientationchange', listener)
    viewport?.removeEventListener('resize', listener)
  }
}

function parseViewportSnapshot(snapshot: string): { width: number; height: number } | null {
  if (snapshot === UNKNOWN_VIEWPORT) return null
  const [rawWidth, rawHeight] = snapshot.split('x')
  const width = Number(rawWidth)
  const height = Number(rawHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  return { width, height }
}

export function DashboardLedgerViewportGuard({
  children,
  className,
  mode = 'inline',
}: {
  children: ReactNode
  className?: string
  mode?: 'inline' | 'fullscreen'
}) {
  const fullScreen = mode === 'fullscreen'
  const snapshot = useSyncExternalStore(
    subscribeViewport,
    viewportSnapshot,
    serverViewportSnapshot
  )
  const dimensions = parseViewportSnapshot(snapshot)
  const blocked =
    !dimensions || isPocketSizedViewport(dimensions.width, dimensions.height)

  if (!blocked) return <>{children}</>

  return (
    <section
      className={cn(
        'flex min-h-[22rem] flex-1 items-center justify-center p-4 text-center sm:p-6',
        fullScreen && 'h-full min-h-screen bg-stone-950 text-stone-50',
        className
      )}
      role="status"
      aria-live="polite"
      aria-labelledby="floor-plan-matrix-small-screen-title"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-2xl border bg-white p-6 text-left shadow-xl sm:p-8',
          fullScreen
            ? 'border-stone-700 bg-stone-900 text-stone-50'
            : 'border-amber-200 text-stone-900'
        )}
      >
        <div
          className={cn(
            'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl',
            fullScreen
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-amber-100 text-amber-800'
          )}
        >
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h2
          id="floor-plan-matrix-small-screen-title"
          className="font-heading text-xl font-bold tracking-tight sm:text-2xl"
        >
          Booth matrix needs a desktop-sized layout
        </h2>
        <p
          className={cn(
            'mt-2 text-sm leading-relaxed',
            fullScreen ? 'text-stone-300' : 'text-stone-700'
          )}
        >
          {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}
        </p>
        <p
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-sm',
            fullScreen
              ? 'border-stone-700 bg-stone-800/60 text-stone-300'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          )}
        >
          Minimum viewport: {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </section>
  )
}
