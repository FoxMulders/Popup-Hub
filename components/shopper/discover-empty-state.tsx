'use client'

import Link from 'next/link'
import { Bell, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clampSliderRadiusKm, DISTANCE_RADIUS_MAX_KM } from '@/lib/markets/distance-radius'
import {
  noPopupHubCommunityMarketsHeadline,
  noPopupHubQuarterAuctionsHeadline,
  popupHubDiscoveryPromo,
  popupHubDiscoveryPromoCompact,
} from '@/lib/copy/popup-hub-discovery'
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

const CITY_LINKS = [
  { href: '/markets/edmonton', label: 'Edmonton markets' },
  { href: '/markets/calgary', label: 'Calgary markets' },
  { href: '/markets/edmonton/vendor-applications', label: 'Edmonton vendor applications' },
  { href: '/markets/calgary/vendor-applications', label: 'Calgary vendor applications' },
] as const

interface DiscoverEmptyStateProps {
  liveAuctionsOnly: boolean
  datePreset: DateFilterPreset
  radiusKm: number | null
  upcomingInAreaCount: number
  onTryPreset: (preset: DateFilterPreset) => void
  onWidenRadius: () => void
  onShowEverywhere: () => void
  onClearLiveAuctionFilter?: () => void
  marketAlertsHref?: string
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
  marketAlertsHref,
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
          ? noPopupHubQuarterAuctionsHeadline
          : noPopupHubCommunityMarketsHeadline}
      </p>
      {!compact ? (
        <p className="mt-2 text-sm text-muted-foreground">{popupHubDiscoveryPromo}</p>
      ) : (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {popupHubDiscoveryPromoCompact}
        </p>
      )}
      {!compact && upcomingInAreaCount > 0 ? (
        <p className="mt-2 text-sm text-foreground">
          <span className="font-semibold">{upcomingInAreaCount}</span> Popup Hub market
          {upcomingInAreaCount === 1 ? '' : 's'} coming up nearby in the next two months — try a
          different date or widen your search.
        </p>
      ) : !compact ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Try a broader date, browse Alberta city guides, or explore open vendor applications.
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
        {datePreset !== 'this_month' ? (
          <Button
            type="button"
            size={compact ? 'sm' : 'default'}
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
            Show Popup Hub markets everywhere
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
      {!compact ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          {CITY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-forest hover:underline underline-offset-2"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          'flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm',
          compact ? 'mt-2' : 'mt-4'
        )}
      >
        <Link
          href="/for-organizers"
          className="font-medium text-forest hover:underline underline-offset-2"
        >
          Host a market on Popup Hub
        </Link>
        <Link
          href="/for-vendors"
          className="font-medium text-forest hover:underline underline-offset-2"
        >
          Apply as a vendor
        </Link>
        <Link
          href="/check"
          className="inline-flex items-center gap-1 font-medium text-forest hover:underline underline-offset-2"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Verify organizer (HubGuard)
        </Link>
      </div>
      {marketAlertsHref ? (
        <p className={cn('text-muted-foreground', compact ? 'mt-2 text-xs' : 'mt-4 text-sm')}>
          <Link
            href={marketAlertsHref}
            className="inline-flex items-center gap-1.5 font-medium text-forest hover:underline underline-offset-2"
          >
            <Bell className="h-3.5 w-3.5" aria-hidden />
            Get notified when new Popup Hub markets publish near you
          </Link>
        </p>
      ) : null}
    </div>
  )
}
