'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { CanvasCommandBar } from './canvas-command-bar'

type CanvasFloatingDockProps = Omit<
  ComponentProps<typeof CanvasCommandBar>,
  'staticLayout' | 'sidebarLayout' | 'topBarLayout' | 'headerBarLayout' | 'verticalRailLayout' | 'floatingDockLayout'
>

/** Semi-transparent bottom-center dock — zoom, undo/redo, fullscreen, presenter. */
export function CanvasFloatingDock({ className, ...props }: CanvasFloatingDockProps) {
  return (
    <div
      className={cn(
        'canvas-floating-dock pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2',
        className
      )}
    >
      <CanvasCommandBar
        {...props}
        staticLayout
        floatingDockLayout
        className="pointer-events-auto flex min-h-[var(--canvas-floating-dock-height,2.5rem)] items-center gap-0.5 rounded-full border border-stone-600/40 bg-stone-900/85 px-2 py-1 shadow-lg backdrop-blur-md [&_.command-button]:text-white/90 [&_.command-button:hover]:bg-white/10 [&_.command-button[disabled]]:opacity-40 [&_button]:text-white/90"
      />
    </div>
  )
}
