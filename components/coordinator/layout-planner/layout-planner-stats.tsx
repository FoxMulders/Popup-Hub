'use client'

import { cn } from '@/lib/utils'

export interface LayoutPlannerStatsProps {
  placedCount: number
  layoutCapacity?: number
  hasOverlap?: boolean
  className?: string
}

/** Compact placed-count and capacity readout for the left rail. */
export function LayoutPlannerStats({
  placedCount,
  layoutCapacity,
  hasOverlap = false,
  className,
}: LayoutPlannerStatsProps) {
  return (
    <div className={cn('space-y-2 text-xs', className)}>
      <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Canvas
        </p>
        <p className="mt-1 tabular-nums font-semibold text-foreground">
          {placedCount} object{placedCount === 1 ? '' : 's'} placed
        </p>
        {layoutCapacity != null ? (
          <p className="mt-0.5 tabular-nums text-muted-foreground">
            Max booths{' '}
            <span className="font-medium text-foreground">{layoutCapacity}</span>
          </p>
        ) : null}
      </div>
      {hasOverlap ? (
        <p className="rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-1.5 font-medium text-amber-950">
          Resolve overlaps before deploying.
        </p>
      ) : null}
    </div>
  )
}
