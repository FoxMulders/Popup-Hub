'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LockedModuleOverlay } from './locked-module-overlay'
import type { FomoTooltipId } from './fomo-tooltips'

export interface LockedModuleShellProps {
  locked: boolean
  unlocking?: boolean
  title: string
  description: string
  tooltipId: FomoTooltipId
  onUpgrade: () => void
  children: ReactNode
  className?: string
}

export function LockedModuleShell({
  locked,
  unlocking = false,
  title,
  description,
  tooltipId,
  onUpgrade,
  children,
  className,
}: LockedModuleShellProps) {
  const showLockedChrome = locked && !unlocking

  return (
    <div className={cn('relative h-full min-h-0', className)}>
      <div
        className={cn(
          'h-full min-h-0',
          showLockedChrome && 'pointer-events-none select-none opacity-35',
          unlocking && 'pointer-events-auto select-auto opacity-100 transition-opacity duration-300'
        )}
      >
        {children}
      </div>
      {locked ? (
        <LockedModuleOverlay
          title={title}
          description={description}
          tooltipId={tooltipId}
          onUpgrade={onUpgrade}
          unlocking={unlocking}
        />
      ) : null}
    </div>
  )
}
