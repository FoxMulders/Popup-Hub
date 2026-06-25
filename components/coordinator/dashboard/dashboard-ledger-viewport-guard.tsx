'use client'

import { Monitor } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  isPocketSizedViewport,
  useIsPocketSizedViewport,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  `The floor plan matrix is not optimized for small screens. Recommended layout desktop size breakpoint: ${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide by ${FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.`

const SERVER_VIEWPORT_SNAPSHOT = {
  width: FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  height: FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  measured: false,
}

let lastViewportSnapshot = SERVER_VIEWPORT_SNAPSHOT

function subscribeViewport(listener: () => void) {
  window.addEventListener('resize', listener)
  window.addEventListener('orientationchange', listener)
  return () => {
    window.removeEventListener('resize', listener)
    window.removeEventListener('orientationchange', listener)
  }
}

function getViewportSnapshot() {
  const width = window.innerWidth
  const height = window.innerHeight
  if (
    lastViewportSnapshot.measured &&
    lastViewportSnapshot.width === width &&
    lastViewportSnapshot.height === height
  ) {
    return lastViewportSnapshot
  }
  lastViewportSnapshot = { width, height, measured: true }
  return lastViewportSnapshot
}

function getServerViewportSnapshot() {
  return SERVER_VIEWPORT_SNAPSHOT
}

export function DashboardLedgerSmallScreenWarning({
  className,
  dark = false,
}: {
  className?: string
  dark?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm shadow-sm',
        dark
          ? 'border-amber-300/40 bg-amber-200/10 text-amber-50'
          : 'border-amber-300 bg-amber-50 text-amber-950',
        className
      )}
      role="status"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="flex gap-3">
        <Monitor
          className={cn('mt-0.5 h-5 w-5 shrink-0', dark ? 'text-amber-200' : 'text-amber-700')}
          aria-hidden
        />
        <div>
          <p className="font-semibold">Booth matrix needs a larger screen</p>
          <p className={cn('mt-1 leading-relaxed', dark ? 'text-amber-50/85' : 'text-amber-900')}>
            {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING} Open this view on a desktop-sized
            display to keep booth labels, vendors, categories, and payment status readable.
          </p>
        </div>
      </div>
    </div>
  )
}

export function DashboardLedgerResponsiveWarning({
  className,
  dark = false,
}: {
  className?: string
  dark?: boolean
}) {
  const isPocketSized = useIsPocketSizedViewport()
  if (!isPocketSized) return null
  return <DashboardLedgerSmallScreenWarning className={className} dark={dark} />
}

export function DashboardLedgerViewportGuard({
  children,
  mode = 'presenter',
}: {
  children: ReactNode
  mode?: 'presenter' | 'wall-cast'
}) {
  const viewport = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    getServerViewportSnapshot
  )
  const isWallCast = mode === 'wall-cast'

  if (!viewport.measured) {
    return (
      <div
        className={cn(
          'dashboard-ledger-window flex h-full min-h-0 items-center justify-center p-4 text-sm',
          isWallCast ? 'bg-stone-950 text-stone-400' : 'bg-stone-50 text-stone-600'
        )}
        data-dual-screen-mode={mode}
      >
        Checking display size…
      </div>
    )
  }

  const isPocketSized = isPocketSizedViewport(viewport.width, viewport.height)
  if (!isPocketSized) return <>{children}</>

  return (
    <div
      className={cn(
        'dashboard-ledger-window flex h-full min-h-0 flex-col items-center justify-center p-4',
        isWallCast ? 'bg-stone-950 text-stone-50' : 'bg-stone-50 text-stone-900'
      )}
      data-dual-screen-mode={mode}
    >
      <DashboardLedgerSmallScreenWarning
        className="w-full max-w-xl"
        dark={isWallCast}
      />
    </div>
  )
}
