'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface CommandCenterShellProps {
  header?: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  className?: string
  /** Accessible name for the left column landmark */
  leftLabel?: string
  /** Accessible name for the center column landmark */
  centerLabel?: string
  /** Accessible name for the right column landmark */
  rightLabel?: string
}

/**
 * Site-wide fixed-viewport 3-column grid:
 * 320px curation rail | 1fr canvas | 360px telemetry desk.
 */
export function CommandCenterShell({
  header,
  left,
  center,
  right,
  className,
  leftLabel = 'Curation and navigation',
  centerLabel = 'Primary workspace',
  rightLabel = 'Telemetry and sync desk',
}: CommandCenterShellProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-canvas',
        className
      )}
    >
      {header ? (
        <header className="shrink-0 border-b border-stone-200/80 bg-card/90 px-4 py-3 backdrop-blur-sm">
          {header}
        </header>
      ) : null}
      <motion.div
        layout
        className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[var(--command-center-left,320px)_minmax(0,1fr)_var(--command-center-right,360px)]"
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <aside
          className="ecosystem-panel min-h-0 overflow-hidden border-b border-stone-200/70 lg:mr-0 lg:border-b-0 lg:border-r"
          aria-label={leftLabel}
        >
          <div className="flex h-full min-h-0 flex-col">{left}</div>
        </aside>
        <section
          className="relative min-h-0 min-w-0 overflow-hidden border-b border-stone-200/70 lg:border-b-0 lg:border-r lg:border-stone-200/70"
          aria-label={centerLabel}
        >
          {center}
        </section>
        <aside
          className="ecosystem-panel min-h-0 overflow-hidden"
          aria-label={rightLabel}
        >
          <div className="flex h-full min-h-0 flex-col">{right}</div>
        </aside>
      </motion.div>
    </div>
  )
}
