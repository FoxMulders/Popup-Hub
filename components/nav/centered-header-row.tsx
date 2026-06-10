'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CenteredHeaderRowProps {
  /** Logo / brand lockup — rendered flush left. */
  left: ReactNode
  /** Portal tabs, nav links, and other middle chrome (fills remaining space). */
  center: ReactNode
  /** Profile, menu, and utility actions — aligned right. */
  right: ReactNode
  className?: string
}

/**
 * Three-zone header row: brand on the far left, flexible middle, actions on the
 * right. Middle zone clips overflow so the bar never grows a horizontal scrollbar.
 */
export function CenteredHeaderRow({
  left,
  center,
  right,
  className,
}: CenteredHeaderRowProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-start gap-2 overflow-x-hidden sm:gap-3 md:gap-4',
        className
      )}
    >
      <div className="mr-auto shrink-0">{left}</div>
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2 overflow-x-hidden sm:gap-3 md:gap-4">
        {center}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 overflow-x-hidden">{right}</div>
    </div>
  )
}
