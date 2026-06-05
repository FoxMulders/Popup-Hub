'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PLACEMENT_AVAILABLE,
  PLACEMENT_VIOLATION,
} from './placement-theme'

/**
 * Persistent canvas allocation legend.
 *
 * Pinned to the bottom-left corner of the canvas viewport so it
 * stays visible while the user pans / zooms / draws / runs
 * Auto-Arrange. Explains the meaning of the sky / red status
 * colours that the canvas applies to booth and zone overlays so
 * coordinators can decode placement feedback without needing to
 * memorise the colour grammar.
 *
 * The legend is collapsible — coordinators who already know the
 * grammar can fold it down to a single chip ("Legend ▴") to free
 * canvas real estate, and the collapsed/expanded state survives
 * across sessions via `localStorage`.
 */
const STORAGE_KEY = 'popup-hub:floor-plan-v2:legend-collapsed'

interface LegendItem {
  swatchClass: string
  label: string
  detail: string
}

const ITEMS: LegendItem[] = [
  {
    swatchClass: 'bg-emerald-500 ring-1 ring-emerald-700/30',
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
]

export function CanvasLegend({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false)

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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show allocation legend"
        aria-label="Show allocation legend"
        aria-expanded={false}
        className={cn(
          'absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600 shadow-md backdrop-blur-sm hover:bg-white',
          className
        )}
      >
        <span className="flex items-center gap-0.5">
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
        <ChevronUp className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div
      className={cn(
        'absolute top-3 right-3 z-20 max-w-[220px] rounded-lg border border-stone-200/90 bg-white/90 p-2 shadow-md backdrop-blur-sm',
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
      <ul className="space-y-1.5">
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
            />
            <span className="min-w-0">
              <span className="font-semibold text-stone-800">{item.label}</span>
            <span className="block text-stone-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
