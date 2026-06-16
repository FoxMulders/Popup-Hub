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
  /** When true, the shell grows with content and the window handles scroll. */
  documentScroll?: boolean
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
  documentScroll = false,
  leftLabel = 'Curation and navigation',
  centerLabel = 'Primary workspace',
  rightLabel = 'Telemetry and sync desk',
}: CommandCenterShellProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-cream site-surface',
        documentScroll ? 'w-full' : 'h-full min-h-0 overflow-hidden',
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
        className={cn(
          'grid grid-cols-1 lg:grid-cols-[var(--command-center-left,320px)_minmax(0,1fr)_var(--command-center-right,360px)]',
          documentScroll ? 'w-full' : 'min-h-0 flex-1 overflow-hidden'
        )}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <aside
          className={cn(
            'ecosystem-panel hidden flex-col border-b border-stone-200/70 lg:flex lg:border-b-0 lg:border-r',
            documentScroll ? '' : 'min-h-0 overflow-hidden'
          )}
          aria-label={leftLabel}
        >
          <div
            className={cn(
              'flex min-h-0 flex-col',
              documentScroll
                ? 'lg:max-h-[calc(100dvh-var(--app-nav-height,4.5rem))] lg:overflow-y-auto lg:overscroll-y-contain lg:[-webkit-overflow-scrolling:touch]'
                : 'h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
            )}
          >
            {left}
          </div>
        </aside>
        <section
          className={cn(
            'relative flex min-w-0 flex-1 flex-col lg:border-r lg:border-stone-200/70',
            documentScroll ? '' : 'min-h-0 overflow-hidden'
          )}
          aria-label={centerLabel}
        >
          {center}
        </section>
        <aside
          className={cn(
            'ecosystem-panel hidden flex-col lg:flex',
            documentScroll ? '' : 'min-h-0 overflow-hidden'
          )}
          aria-label={rightLabel}
        >
          <div
            className={cn(
              'flex min-h-0 flex-col',
              documentScroll
                ? 'lg:max-h-[calc(100dvh-var(--app-nav-height,4.5rem))] lg:overflow-y-auto lg:overscroll-y-contain lg:[-webkit-overflow-scrolling:touch]'
                : 'h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
            )}
          >
            {right}
          </div>
        </aside>
      </motion.div>
    </div>
  )
}
