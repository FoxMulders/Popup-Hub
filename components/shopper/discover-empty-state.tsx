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

interface DiscoverEmptyStateProps {
  liveAuctionsOnly: boolean
  datePreset: DateFilterPreset
  radiusKm: number | null
  upcomingInAreaCount: number
  onTryPreset: (preset: DateFilterPreset) => void
  onWidenRadius: () => void
  onShowEverywhere: () => void
  onClearLiveAuctionFilter?: () => void
  className?: string
  compact?: boolean
}

export function DiscoverEmptyState({
  liveAuctionsOnly,
  datePreset,
  radiusKm,
  upcomingInAreaCount,
  onTryPreset,
  onWidenRadius,
  onShowEverywhere,
  onClearLiveAuctionFilter,
  className,
  compact = false,
}: DiscoverEmptyStateProps) {
  const fallbackPreset = suggestDiscoverFallbackPreset(datePreset)
  const canWiden = radiusKm != null && radiusKm < DISTANCE_RADIUS_MAX_KM

  return (
    <div
      className={cn(
        compact
          ? 'rounded-xl border border-stone-200 bg-white/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm'
          : 'rounded-2xl marketing-glass-card px-6 py-10 text-center',
        className
      )}
    >
      <p className={cn('text-muted-foreground', compact ? 'text-xs font-medium' : 'text-sm')}>
        {liveAuctionsOnly
          ? 'No quarter auctions match this day and area.'
          : 'No community markets match this day and area.'}
      </p>
      {!compact && upcomingInAreaCount > 0 ? (
        <p className="mt-2 text-sm text-foreground">
          <span className="font-semibold">{upcomingInAreaCount}</span> market
          {upcomingInAreaCount === 1 ? '' : 's'} coming up nearby in the next two months — try a
          different date or widen your search.
        </p>
      ) : !compact ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Try a broader date, widen your radius, or browse all published markets.
        </p>
      ) : null}
      <div
        className={cn(
          'flex flex-wrap items-center justify-center gap-2',
          compact ? 'mt-2' : 'mt-6'
        )}
      >
        {fallbackPreset ? (
          <Button
            type="button"
            size={compact ? 'sm' : 'default'}
            variant="default"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={() => onTryPreset(fallbackPreset)}
          >
            Try {FALLBACK_PRESET_LABEL[fallbackPreset]}
          </Button>
        ) : null}
        {canWiden ? (
          <Button
            type="button"
            size={compact ? 'sm' : 'default'}
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
            size={compact ? 'sm' : 'default'}
            variant="outline"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={onShowEverywhere}
          >
            Show markets everywhere
          </Button>
        ) : null}
        {liveAuctionsOnly && onClearLiveAuctionFilter ? (
          <Button
            type="button"
            size={compact ? 'sm' : 'default'}
            variant="ghost"
            className="min-h-10 touch-manipulation rounded-full"
            onClick={onClearLiveAuctionFilter}
          >
            Show all markets
          </Button>
        ) : null}
      </div>
    </div>
  )
}
