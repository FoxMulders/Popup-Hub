'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FloorPlanSidebarProps {
  side: 'left' | 'right'
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}

export function FloorPlanSidebar({
  side,
  title,
  collapsed,
  onToggle,
  children,
  className,
}: FloorPlanSidebarProps) {
  const CollapseIcon = side === 'left' ? ChevronLeft : ChevronRight
  const ExpandIcon = side === 'left' ? ChevronRight : ChevronLeft

  return (
    <aside
      className={cn(
        // The sidebar flows naturally inside the floor-plan workspace
        // column. It is intentionally NOT sticky-positioned and has no
        // capped height — the entire column extends as tall as its
        // children require, so panels like Stats & Presets, Your
        // Selections, and Layout Preset never trigger an internal
        // scrollbar. The user scrolls the page instead.
        'flex shrink-0 flex-col transition-[width] duration-200',
        collapsed ? 'w-full md:w-10' : 'w-full md:w-[min(100%,15rem)] xl:w-60',
        className
      )}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-1 border-b border-stone-200 bg-white px-2 py-1.5">
        {!collapsed ? (
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-stone-200 text-muted-foreground hover:bg-canvas hover:text-foreground"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ExpandIcon className="h-3.5 w-3.5" /> : <CollapseIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed ? (
        // Plain stack — no max-height, no overflow constraint. The
        // surrounding page handles vertical scrolling.
        <div className="flex flex-col gap-2 p-2">{children}</div>
      ) : null}
    </aside>
  )
}
