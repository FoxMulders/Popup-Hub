'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface WorkspaceShellProps {
  header: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  className?: string
}

/**
 * Fixed-viewport IDE-style workspace:
 * 60px step header + 320px wizard | 1fr canvas | 360px inspector.
 */
export function WorkspaceShell({
  header,
  left,
  center,
  right,
  className,
}: WorkspaceShellProps) {
  return (
    <div
      className={cn(
        'flex h-[100vh] flex-col overflow-hidden bg-[#0b0f14] text-foreground',
        className
      )}
    >
      <header className="flex h-[60px] shrink-0 items-center border-b border-white/10 bg-[#0f1419]/95 px-4 backdrop-blur-sm">
        {header}
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_360px] overflow-hidden">
        <aside
          className="min-h-0 overflow-hidden border-r border-white/10 bg-[#0f1419]"
          aria-label="Design wizard"
        >
          <div className="flex h-full min-h-0 flex-col">{left}</div>
        </aside>
        <section
          className="relative min-h-0 min-w-0 overflow-hidden"
          aria-label="Spatial blueprint canvas"
        >
          {center}
        </section>
        <aside
          className="min-h-0 overflow-hidden border-l border-white/10 bg-[#0f1419]"
          aria-label="Inspector and telemetry"
        >
          <div className="flex h-full min-h-0 flex-col">{right}</div>
        </aside>
      </div>
    </div>
  )
}
