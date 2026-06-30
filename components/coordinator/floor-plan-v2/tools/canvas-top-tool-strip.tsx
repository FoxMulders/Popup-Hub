'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { CanvasCommandBar } from './canvas-command-bar'

const STORAGE_KEY = 'popup-hub:hub-grid:canvas-toolbar-collapsed'

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

type CanvasTopToolStripProps = Omit<
  ComponentProps<typeof CanvasCommandBar>,
  | 'staticLayout'
  | 'sidebarLayout'
  | 'topBarLayout'
  | 'headerBarLayout'
  | 'verticalRailLayout'
  | 'floatingDockLayout'
  | 'hubGridTopLayout'
>

/** Horizontal layout tools strip — sits above the HubGrid canvas grid. */
export function CanvasTopToolStrip({ className, ...props }: CanvasTopToolStripProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(loadCollapsed())
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      saveCollapsed(next)
      return next
    })
  }, [])

  return (
    <div
      className={cn(
        'canvas-top-tool-strip shrink-0 w-full border-b border-stone-200/80 bg-card/95 backdrop-blur-sm',
        collapsed && 'canvas-top-tool-strip--collapsed',
        className
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="flex min-w-0 items-center gap-1 border-b border-stone-100/80 px-1 py-0.5">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? 'Expand layout tools' : 'Collapse layout tools'}
          aria-label={collapsed ? 'Expand layout tools' : 'Collapse layout tools'}
          aria-expanded={!collapsed}
          className="inline-flex h-[var(--dashboard-toolbar-height,1.75rem)] w-[var(--dashboard-toolbar-height,1.75rem)] shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <span className="text-[11px] font-semibold text-stone-700">Layout tools</span>
      </div>
      {!collapsed ? (
        <div className="min-w-0 overflow-x-auto px-1 py-0.5">
          <CanvasCommandBar
            {...props}
            staticLayout
            hubGridTopLayout
            className="w-full min-w-0 border-0 bg-transparent px-0 py-0 shadow-none"
          />
        </div>
      ) : null}
    </div>
  )
}
