'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  QA_PLACEMENT_TIP_VALID,
  QA_PLACEMENT_TIP_VIOLATION,
} from '@/src/qa_review/components/coordinator/dashboard/Dashboard_qa'
import {
  PLACEMENT_AVAILABLE,
  PLACEMENT_VIOLATION,
} from '@/components/coordinator/floor-plan-v2/canvas/placement-theme'

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
    detail: QA_PLACEMENT_TIP_VALID,
  },
  {
    swatchClass: PLACEMENT_VIOLATION.tailwindSwatch,
    label: 'Violation',
    detail: QA_PLACEMENT_TIP_VIOLATION,
  },
]

/** QA Placement HUD — microcopy only (Valid space / Rule conflict). */
export function CanvasLegendQa({ className }: { className?: string }) {
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
          'absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600 shadow-lg backdrop-blur-sm hover:bg-white',
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
        'absolute top-4 right-4 z-10 max-w-[220px] rounded-lg border border-stone-200/90 bg-white/95 p-2 shadow-lg backdrop-blur-sm',
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
