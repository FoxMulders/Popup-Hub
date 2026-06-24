'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { CanvasCommandBar } from './canvas-command-bar'

type CanvasVerticalToolRailProps = Omit<
  ComponentProps<typeof CanvasCommandBar>,
  'staticLayout' | 'sidebarLayout' | 'topBarLayout' | 'headerBarLayout' | 'verticalRailLayout' | 'floatingDockLayout'
>

/** Slim vertical drawing tool rail — left edge of the canvas host. */
export function CanvasVerticalToolRail({ className, ...props }: CanvasVerticalToolRailProps) {
  return (
    <div
      className={cn(
        'canvas-vertical-tool-rail pointer-events-none absolute inset-y-0 left-0 z-10 flex w-[var(--canvas-tool-rail-width,2.75rem)] flex-col',
        className
      )}
    >
      <CanvasCommandBar
        {...props}
        staticLayout
        verticalRailLayout
        className="pointer-events-auto m-1.5 flex h-auto min-h-0 w-[calc(var(--canvas-tool-rail-width,2.75rem)-0.75rem)] flex-col gap-1 rounded-lg border border-stone-200/80 bg-white/90 p-1 shadow-md backdrop-blur-sm"
      />
    </div>
  )
}
