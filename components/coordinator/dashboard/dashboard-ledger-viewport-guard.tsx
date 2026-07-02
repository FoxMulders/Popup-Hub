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

const FLOOR_PLAN_MATRIX_BREAKER_COPY = `Use a viewport at least ${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and ${FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall for HubGrid matrix review.`

export function FloorPlanMatrixSmallScreenNotice({
  className,
  compact = false,
  tone = 'light',
}: {
  className?: string
  compact?: boolean
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm shadow-sm',
        dark
          ? 'border-amber-400/40 bg-amber-300/10 text-amber-50'
          : 'border-amber-300/80 bg-amber-50 text-amber-950',
        compact && 'rounded-lg px-3 py-2 text-xs',
        className
      )}
      role="status"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="flex gap-3">
        <Monitor
          className={cn(
            'mt-0.5 shrink-0',
            compact ? 'h-4 w-4' : 'h-5 w-5',
            dark ? 'text-amber-200' : 'text-amber-700'
          )}
          aria-hidden
        />
        <div>
          <p className="font-semibold">{FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}</p>
          {!compact ? (
            <p className={cn('mt-1', dark ? 'text-amber-100/85' : 'text-amber-900/90')}>
              {FLOOR_PLAN_MATRIX_BREAKER_COPY}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function FloorPlanMatrixSmallScreenWarning({
  className,
  compact,
  tone,
}: {
  className?: string
  compact?: boolean
  tone?: 'light' | 'dark'
}) {
  const smallScreen = useIsPocketSizedViewport()

  if (!smallScreen) return null

  return (
    <FloorPlanMatrixSmallScreenNotice
      className={className}
      compact={compact}
      tone={tone}
    />
  )
}

export function DashboardLedgerViewportGuard({ children }: { children: ReactNode }) {
  const smallScreen = useIsPocketSizedViewport()

  if (!smallScreen) return <>{children}</>

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-stone-950 p-4 text-stone-50">
      <div className="w-full max-w-lg">
        <FloorPlanMatrixSmallScreenNotice tone="dark" />
      </div>
    </div>
  )
}
