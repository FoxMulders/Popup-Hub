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
 * Three-zone header row with a centered middle column (logo) and balanced side
 * rails so actions stay right-aligned without shifting the brand mark.
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
        'grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-x-hidden sm:gap-3 md:gap-4',
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-start gap-2 overflow-x-hidden">
        {left}
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-visible px-1">
        {center}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-hidden">
        {right}
      </div>
    </div>
  )
}
