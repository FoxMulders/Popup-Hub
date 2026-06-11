'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CanvasSideRail } from './canvas-side-rail'
import {
  PLACEMENT_AVAILABLE,
  PLACEMENT_VIOLATION,
  VENDOR_BOOTH_LEGEND,
} from './placement-theme'
import { BOOTH_CLEARANCE_THEMES } from '@/lib/coordinator/booth-clearance-visual'

/**
 * Persistent canvas allocation legend.
 *
 * Pinned to the canvas viewport so it stays visible while the user
 * pans / zooms / draws / runs Auto-Arrange. Explains the meaning of
 * the sky / red status colours that the canvas applies to booth and
 * zone overlays so coordinators can decode placement feedback without
 * needing to memorise the colour grammar.
 *
 * Docked / sidebar variants sit in flex side rails beside the canvas —
 * only a chevron tab remains when collapsed. Expanded rails reserve
 * 200px + tab width so the floor plan never renders underneath them.
 * Collapsed / expanded state survives across sessions via `localStorage`.
 */
const STORAGE_KEY = 'popup-hub:floor-plan-v2:legend-collapsed'

interface LegendItem {
  swatchClass: string
  label: string
  detail: string
  swatchFill?: string
  swatchStroke?: string
}

const ITEMS: LegendItem[] = [
  {
    swatchClass: VENDOR_BOOTH_LEGEND.tailwindSwatch,
    label: 'Vendor',
    detail: 'Vendor booth footprint — assigned, unassigned, and open slots.',
  },
  {
    swatchClass: PLACEMENT_AVAILABLE.tailwindSwatch,
    label: 'Available',
    detail:
      'Valid space — meets clearance and category-proximity rules. Safe to drop a booth here.',
  },
  {
    swatchClass: PLACEMENT_VIOLATION.tailwindSwatch,
    label: 'Violation',
    detail:
      'Constraint violation — fails the 4-column / 2-row same-category freeze, overlaps a barrier, or blocks an emergency corridor.',
  },
  {
    swatchClass: 'bg-red-200 ring-1 ring-red-500',
    label: 'Critical clearance',
    detail: '<3′ edge clearance — move booth away from walls or neighbors.',
    swatchFill: BOOTH_CLEARANCE_THEMES.critical.fill,
    swatchStroke: BOOTH_CLEARANCE_THEMES.critical.stroke,
  },
  {
    swatchClass: 'bg-orange-200 ring-1 ring-orange-500',
    label: 'Tight clearance',
    detail: '≥3′ and <4′ edge clearance — aim for 4′ before publishing.',
    swatchFill: BOOTH_CLEARANCE_THEMES.tight.fill,
    swatchStroke: BOOTH_CLEARANCE_THEMES.tight.stroke,
  },
  {
    swatchClass: 'bg-emerald-200 ring-1 ring-emerald-500',
    label: 'Ideal clearance',
    detail: '≥4′ edge clearance — safe patron aisle spacing.',
    swatchFill: BOOTH_CLEARANCE_THEMES.good.fill,
    swatchStroke: BOOTH_CLEARANCE_THEMES.good.stroke,
  },
]

function LegendItemsList({ docked }: { docked?: boolean }) {
  return (
    <ul className={cn('space-y-1.5', docked && 'min-h-0 flex-1 overflow-y-auto')}>
      {ITEMS.map((item) => (
        <li
          key={item.label}
          className="flex items-start gap-2 text-[11px] leading-snug"
        >
          <span
            aria-hidden
            className={cn(
              'mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm',
              item.swatchClass
            )}
            style={
              item.swatchFill
                ? {
                    backgroundColor: item.swatchFill,
                    border: `1px solid ${item.swatchStroke ?? item.swatchFill}`,
                  }
                : undefined
            }
          />
          <span className="min-w-0">
            <span className="font-semibold text-stone-800">{item.label}</span>
            <span className="block text-stone-500">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function LeftCollapsibleLegendPanel({
  collapsed,
  onCollapsedChange,
  docked,
  className,
}: {
  collapsed: boolean
  onCollapsedChange: (next: boolean) => void
  docked?: boolean
  className?: string
}) {
  return (
    <CanvasSideRail
      side="left"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      title="Legend"
      ariaLabel="Allocation legend"
      expandTitle="Show allocation legend"
      collapseTitle="Hide allocation legend"
      className={cn('canvas-legend-panel', className)}
      panelClassName={cn(
        'canvas-legend-docked min-h-0',
        docked && 'max-w-none shadow-[4px_0_20px_rgb(28_25_23_/_0.1)]'
      )}
    >
      <LegendItemsList docked={docked} />
    </CanvasSideRail>
  )
}

export function CanvasLegend({
  className,
  variant = 'floating',
}: {
  className?: string
  variant?: 'floating' | 'sidebar' | 'docked'
}) {
  const [collapsed, setCollapsed] = useState(false)
  const isDocked = variant === 'docked'
  const isSidebar = variant === 'sidebar' || isDocked
  const isLeftPanel = isSidebar

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === '1') setCollapsed(true)
    } catch {
      // Private mode / quota — fall back to expanded by default.
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Persistence is best-effort; the in-memory state still works.
    }
  }, [collapsed])

  if (isLeftPanel) {
    return (
      <LeftCollapsibleLegendPanel
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        docked={isDocked}
        className={className}
      />
    )
  }

  const positionClass = 'absolute top-4 right-4 z-10'

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show allocation legend"
        aria-label="Show allocation legend"
        aria-expanded={false}
        className={cn(
          positionClass,
          'inline-flex items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600 shadow-lg backdrop-blur-sm hover:bg-white',
          className
        )}
      >
        <span className="flex items-center gap-0.5">
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-sm',
              VENDOR_BOOTH_LEGEND.tailwindSwatch
            )}
          />
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-sm',
              PLACEMENT_AVAILABLE.tailwindSwatchCollapsed
            )}
          />
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-sm',
              PLACEMENT_VIOLATION.tailwindSwatch
            )}
          />
        </span>
        Legend
        <ChevronDown className="h-3 w-3 rotate-180" />
      </button>
    )
  }

  return (
    <div
      className={cn(
        positionClass,
        'max-w-[200px] rounded-lg border border-stone-200/90 bg-white/95 p-2 shadow-lg backdrop-blur-sm',
        className
      )}
      role="region"
      aria-label="Allocation legend"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-stone-500">
          Placement HUD
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Hide legend"
          aria-label="Hide allocation legend"
          aria-expanded={true}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <LegendItemsList />
    </div>
  )
}
