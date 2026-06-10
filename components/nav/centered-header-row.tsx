'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CenteredHeaderRowProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  className?: string
}

/**
 * Three-zone header row with the center slot absolutely centered so sibling
 * controls (back button, profile) do not push the logo off-center.
 */
export function CenteredHeaderRow({ left, center, right, className }: CenteredHeaderRowProps) {
  return (
    <div className={cn('relative flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 lg:gap-6">{left}</div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto">{center}</div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">{right}</div>
    </div>
  )
}
