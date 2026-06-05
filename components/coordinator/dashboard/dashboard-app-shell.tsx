import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DashboardAppShellProps {
  header?: ReactNode
  left: ReactNode
  center: ReactNode
  /** Omitted on booth designer — payment telemetry lives under Payments. */
  right?: ReactNode | null
  /** Hides side columns; header should be minimal (back link only). */
  immersive?: boolean
  className?: string
  leftLabel?: string
  centerLabel?: string
  rightLabel?: string
  /** Root landmark for coordinator dashboard bootstrap */
  id?: string
  /** Set while zones are still loading */
  ariaBusy?: boolean
}

/**
 * Zero-CLS static shell matching {@link CommandCenterShell} grid:
 * 320px | 1fr | 360px. Renders immediately without waiting on data or Framer layout.
 */
export function DashboardAppShell({
  header,
  left,
  center,
  right,
  immersive = false,
  className,
  leftLabel = 'Curation and navigation',
  centerLabel = 'Primary workspace',
  rightLabel = 'Inspector',
  id = 'coordinator-dashboard-root',
  ariaBusy,
}: DashboardAppShellProps) {
  return (
    <div
      id={id}
      className={cn(
        'dashboard-app-shell flex h-full min-h-0 flex-col overflow-hidden bg-canvas',
        immersive && 'dashboard-app-shell--immersive',
        className
      )}
      aria-busy={ariaBusy === true ? true : ariaBusy === false ? false : undefined}
    >
      {header ? (
        <header
          className={cn(
            'dashboard-app-shell__header shrink-0 border-b border-stone-200/80 bg-card/90 px-4 backdrop-blur-sm',
            immersive ? 'py-2' : 'py-2'
          )}
        >
          {header}
        </header>
      ) : null}
      <div
        className={cn(
          'dashboard-app-shell__grid grid min-h-0 flex-1 overflow-hidden',
          immersive
            ? 'grid-cols-1'
            : right
              ? 'grid-cols-1 lg:grid-cols-[var(--command-center-left,320px)_minmax(0,1fr)_var(--command-center-right,360px)]'
              : 'grid-cols-1 lg:grid-cols-[var(--command-center-left,320px)_minmax(0,1fr)]'
        )}
      >
        {immersive ? null : (
          <aside
            className="ecosystem-panel dashboard-app-shell__left hidden min-h-0 flex-col overflow-hidden border-b border-stone-200/70 lg:flex lg:border-b-0 lg:border-r"
            aria-label={leftLabel}
          >
            <div className="flex h-full min-h-0 flex-col">{left}</div>
          </aside>
        )}
        <section
          className={cn(
            'dashboard-app-shell__center relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            !immersive && 'lg:border-r lg:border-stone-200/70'
          )}
          aria-label={centerLabel}
        >
          {center}
        </section>
        {immersive || !right ? null : (
          <aside
            className="ecosystem-panel dashboard-app-shell__right hidden min-h-0 flex-col overflow-hidden lg:flex"
            aria-label={rightLabel}
          >
            <div className="flex h-full min-h-0 flex-col">{right}</div>
          </aside>
        )}
      </div>
    </div>
  )
}
