'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CenteredHeaderRowProps {
  /** Logo / brand lockup — rendered flush left. */
  left: ReactNode
  /** Portal tabs, nav links, and other middle chrome (centered). */
  center: ReactNode
  /** Profile, menu, and utility actions — aligned right. */
  right: ReactNode
  /** When start, middle zone hugs the logo (single-row mobile chrome). */
  centerAlign?: 'center' | 'start'
  className?: string
}

/**
 * Three-zone header: brand left, navigation truly centered, actions right.
 */
export function CenteredHeaderRow({
  left,
  center,
  right,
  centerAlign = 'center',
  className,
}: CenteredHeaderRowProps) {
  return (
    <div
      className={cn(
        'grid w-full min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2 overflow-x-hidden sm:gap-3',
        className
      )}
    >
      <div className="justify-self-start shrink-0">{left}</div>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 overflow-x-hidden sm:gap-3',
          centerAlign === 'start' ? 'justify-start' : 'justify-center'
        )}
      >
        {center}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 overflow-x-hidden">
        {right}
      </div>
    </div>
  )
}
