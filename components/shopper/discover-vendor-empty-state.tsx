'use client'

import { Button } from '@/components/ui/button'
import { clampSliderRadiusKm, DISTANCE_RADIUS_MAX_KM } from '@/lib/markets/distance-radius'
import type { DateFilterPreset } from '@/lib/shopper/discover-date'
import { suggestDiscoverFallbackPreset } from '@/lib/shopper/discover-date'
import { cn } from '@/lib/utils'

const FALLBACK_PRESET_LABEL: Record<DateFilterPreset, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'This weekend',
  next_weekend: 'Next weekend',
  this_week: 'This week',
  this_month: 'This month',
  custom: 'Pick another date',
}

interface DiscoverVendorEmptyStateProps {
  datePreset: DateFilterPreset
  radiusKm: number | null
  onTryPreset: (preset: DateFilterPreset) => void
  onWidenRadius: () => void
  onShowEverywhere: () => void
  className?: string
}

export function DiscoverVendorEmptyState({
  datePreset,
  radiusKm,
  onTryPreset,
  onWidenRadius,
  onShowEverywhere,
  className,
}: DiscoverVendorEmptyStateProps) {
  const fallbackPreset = suggestDiscoverFallbackPreset(datePreset)
  const canWiden = radiusKm != null && radiusKm < DISTANCE_RADIUS_MAX_KM

  return (
    <div className={cn('rounded-2xl marketing-glass-card px-6 py-10 text-center', className)}>
      <p className="text-sm text-muted-foreground">
        No vendors match your search for this date and area.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try a broader date, widen your search radius, or search for a different vendor or category.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {fallbackPreset ? (
          <Button
            type="button"
            variant="default"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={() => onTryPreset(fallbackPreset)}
          >
            Try {FALLBACK_PRESET_LABEL[fallbackPreset]}
          </Button>
        ) : null}
        {datePreset !== 'this_month' ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={() => onTryPreset('this_month')}
          >
            Try this month
          </Button>
        ) : null}
        {canWiden ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={onWidenRadius}
          >
            Widen to {clampSliderRadiusKm(radiusKm + 25)} km
          </Button>
        ) : null}
        {radiusKm != null ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={onShowEverywhere}
          >
            Search everywhere
          </Button>
        ) : null}
      </div>
    </div>
  )
}
