import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DashboardAppShellProps {
  header?: ReactNode
  /** Horizontal layout-tools strip below the header (Room, Shapes, Alignment, etc.). */
  toolbarStrip?: ReactNode
  left?: ReactNode | null
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
  /** Optional class overrides for the left utility rail */
  leftClassName?: string
  /** Narrow tablet dock (md–lg) — icon rail + sliding drawer for layout tools. */
  tabletLeft?: ReactNode
}

/**
 * Zero-CLS static shell matching {@link CommandCenterShell} grid:
 * 320px | 1fr | 360px. Renders immediately without waiting on data or Framer layout.
 */
export function DashboardAppShell({
  header,
  toolbarStrip,
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
  leftClassName,
  tabletLeft,
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
            'dashboard-app-shell__header shrink-0 border-b border-stone-200/80 bg-card/90 backdrop-blur-sm',
            immersive ? 'py-1' : 'py-1'
          )}
        >
          {header}
        </header>
      ) : null}
      {toolbarStrip ? (
        <div className="dashboard-app-shell__toolbar shrink-0">{toolbarStrip}</div>
      ) : null}
      <div
        className={cn(
          'dashboard-app-shell__grid grid min-h-0 flex-1 overflow-hidden',
          immersive
            ? 'grid-cols-1'
            : right
              ? cn(
                  'grid-cols-1',
                  'lg:grid-cols-[minmax(0,1fr)_var(--command-center-right,360px)]'
                )
              : 'grid-cols-1'
        )}
      >
        {left ? (
          <aside
            className={cn(
              'ecosystem-panel dashboard-app-shell__left hidden min-h-0 flex-col overflow-hidden border-b border-stone-200/70 lg:flex lg:border-b-0 lg:border-r',
              leftClassName
            )}
            aria-label={leftLabel}
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{left}</div>
          </aside>
        ) : null}
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
