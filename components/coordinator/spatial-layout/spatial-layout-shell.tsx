'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLayoutCanvasViewportLock } from '@/components/coordinator/layout-planner/use-layout-canvas-viewport-lock'

export interface SpatialLayoutShellProps {
  toolbar: ReactNode
  children: ReactNode
  className?: string
}

/** Full-viewport editor — canvas is the hero; document scroll is locked. */
export function SpatialLayoutShell({
  toolbar,
  children,
  className,
}: SpatialLayoutShellProps) {
  useLayoutCanvasViewportLock(true)

  return (
    <div
      className={cn(
        'layout-planner-root spatial-layout-root flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas',
        className
      )}
    >
      {toolbar}
      <main
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        aria-label="Floor plan canvas"
      >
        {children}
      </main>
    </div>
  )
}
