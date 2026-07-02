'use client'

import Link from 'next/link'
import { ArrowLeft, BarChart3, ExternalLink, MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ListingTierBadge } from './listing-tier-badge'
import { MarketUpgradeButton } from './market-upgrade-button'
import { FomoFeatureCards } from './fomo-feature-cards'
import {
  adCampaignStatusLabel,
  formatCampaignExpiry,
} from '@/lib/coordinator/conversion-listing'
import { coordinatorStudioHref, COORDINATOR_MARKETS_PATH } from '@/lib/coordinator/coordinator-routes'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import { cn } from '@/lib/utils'
import type { AdCampaignStatus } from '@/types/database'

export interface CampaignDashboardProps {
  event: {
    id: string
    name: string
    startAt: string
    status: string
    isExternalListing: boolean
    destinationUrl: string | null
    adCampaignStatus: AdCampaignStatus | string | null
    adCampaignExpiresAt: string | null
  }
  clicks: {
    total: number
    today: number
    last7Days: number
  }
  recentClicks: Array<{ clickedAt: string; ipHashPrefix: string }>
  squareConnected?: boolean
}

export function CampaignDashboard({
  event,
  clicks,
  recentClicks,
  squareConnected = false,
}: CampaignDashboardProps) {
  const expiryLabel = formatCampaignExpiry(event.adCampaignExpiresAt)
  const trackClickPath = `/api/v1/markets/${encodeURIComponent(event.id)}/track-click`

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-10">
      <div className="flex flex-col gap-3">
        <Link
          href={COORDINATOR_MARKETS_PATH}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit gap-1.5 px-0')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All markets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {safeFormatMarketDate(event.startAt)} · {adCampaignStatusLabel(event.adCampaignStatus)}
              {expiryLabel ? ` · Renews ${expiryLabel}` : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ListingTierBadge
                isExternalListing={event.isExternalListing}
                adCampaignStatus={event.adCampaignStatus}
              />
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {event.status}
              </Badge>
            </div>
          </div>
          {event.isExternalListing ? (
            <MarketUpgradeButton eventId={event.id} squareConnected={squareConnected} size="sm" />
          ) : (
            <Link href={coordinatorStudioHref(event.id)} className={buttonVariants({ size: 'sm' })}>
              Open HubGrid
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="marketing-glass-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
            Today
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{clicks.today}</p>
        </div>
        <div className="marketing-glass-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            7 days
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{clicks.last7Days}</p>
        </div>
        <div className="marketing-glass-card p-4">
          <p className="text-xs text-muted-foreground">All time</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{clicks.total}</p>
        </div>
      </div>

      {event.destinationUrl ? (
        <div className="rounded-xl border border-stone-200/90 bg-white p-4">
          <p className="text-sm font-medium text-foreground">Destination link</p>
          <a
            href={event.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-forest hover:underline"
          >
            {event.destinationUrl}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Discover uses tracked redirect: <code className="text-[11px]">{trackClickPath}</code>
          </p>
        </div>
      ) : null}

      {recentClicks.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent clicks
          </h2>
          <ul className="divide-y rounded-xl border border-stone-200/90 bg-white">
            {recentClicks.map((click) => (
              <li
                key={`${click.clickedAt}-${click.ipHashPrefix}`}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(click.clickedAt).toLocaleString('en-CA')}
                </span>
                <span className="font-mono text-xs text-stone-500">{click.ipHashPrefix}…</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {event.isExternalListing ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Unlock with native (free)
          </h2>
          <FomoFeatureCards compact />
        </section>
      ) : null}
    </div>
  )
}
