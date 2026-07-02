import Link from 'next/link'
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Megaphone,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { PageIntro } from '@/components/layout/page-intro'
import {
  coordinatorStudioHref,
  COORDINATOR_ADVERTISE_PATH,
} from '@/lib/coordinator/coordinator-routes'
import { coordinatorCampaignHref } from '@/lib/coordinator/conversion-listing'
import { ListingTierBadge } from '@/components/coordinator/conversion/listing-tier-badge'
import { MarketUpgradeButton } from '@/components/coordinator/conversion/market-upgrade-button'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import { VendorInviteCopyButton } from '@/components/coordinator/vendor-invite-copy-button'
import { CloneMarketButton } from '@/components/coordinator/clone-market-button'
import { cn } from '@/lib/utils'
import type { AdCampaignStatus } from '@/types/database'

export interface CoordinatorMarketSummary {
  id: string
  name: string
  start_at: string
  status: string
  is_test?: boolean
  coordinator_name?: string | null
  is_external_listing?: boolean
  ad_campaign_status?: AdCampaignStatus | string | null
}

interface CoordinatorMarketsListProps {
  activeMarkets: CoordinatorMarketSummary[]
  archivedMarkets: CoordinatorMarketSummary[]
  totalRevenueCents: number
  squareConnected: boolean
  stripeConnected: boolean
  /** Platform admin viewing all coordinators' markets. */
  isAdminView?: boolean
  /** Shorter intro copy for phones on the dashboard fallback. */
  mobileIntro?: boolean
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function statusLabel(status: string): string {
  if (status === 'draft') return 'Draft'
  if (status === 'published') return 'Published'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function showCloneAction(status: string): boolean {
  return status === 'published' || status === 'active' || status === 'completed' || status === 'cancelled'
}

function MarketRow({
  market,
  showCommandCenterLink,
  showInviteLink,
  showCoordinatorName,
  squareConnected,
}: {
  market: CoordinatorMarketSummary
  showCommandCenterLink: boolean
  showInviteLink?: boolean
  showCoordinatorName?: boolean
  squareConnected?: boolean
}) {
  const isExternal = market.is_external_listing === true

  return (
    <li className="marketing-glass-card transition-colors hover:border-forest/30 hover:shadow-[var(--shadow-market-md)]">
      <div className="flex items-center gap-3 p-4">
        <Link
          href={
            isExternal
              ? coordinatorCampaignHref(market.id)
              : `/coordinator/events/${market.id}`
          }
          className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 font-medium text-foreground">{market.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{safeFormatMarketDate(market.start_at)}</span>
              {showCoordinatorName && market.coordinator_name ? (
                <span className="line-clamp-1">Owner: {market.coordinator_name}</span>
              ) : null}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                {statusLabel(market.status)}
              </Badge>
              <ListingTierBadge
                isExternalListing={isExternal}
                adCampaignStatus={market.ad_campaign_status}
              />
              {market.is_test ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  Test
                </Badge>
              ) : null}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        {isExternal ? (
          <>
            <Link
              href={coordinatorCampaignHref(market.id)}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'hidden shrink-0 gap-1.5 sm:inline-flex'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Campaign
            </Link>
            <div className="hidden sm:block">
              <MarketUpgradeButton eventId={market.id} squareConnected={squareConnected} size="sm" />
            </div>
          </>
        ) : showCommandCenterLink ? (
          <Link
            href={coordinatorStudioHref(market.id)}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden shrink-0 gap-1.5 sm:inline-flex'
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            HubGrid
          </Link>
        ) : (
          <Link
            href={coordinatorStudioHref(market.id)}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden shrink-0 gap-1.5 sm:inline-flex'
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            View layout
          </Link>
        )}
        {!isExternal && showCloneAction(market.status) ? (
          <CloneMarketButton eventId={market.id} variant="ghost" />
        ) : null}
      </div>
      {isExternal ? (
        <div className="border-t border-stone-200/80 px-4 py-2.5 sm:hidden">
          <MarketUpgradeButton eventId={market.id} squareConnected={squareConnected} className="w-full" />
        </div>
      ) : null}
      {showInviteLink && !isExternal ? (
        <div className="border-t border-stone-200/80 px-4 py-2.5">
          <VendorInviteCopyButton eventId={market.id} eventName={market.name} className="w-full sm:w-auto" />
        </div>
      ) : null}
    </li>
  )
}

function MarketSection({
  title,
  markets,
  showCommandCenterLink,
  showInviteLinks,
  showCoordinatorName,
  squareConnected,
}: {
  title: string
  markets: CoordinatorMarketSummary[]
  showCommandCenterLink: boolean
  showInviteLinks?: boolean
  showCoordinatorName?: boolean
  squareConnected?: boolean
}) {
  if (markets.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {markets.map((market) => (
          <MarketRow
            key={market.id}
            market={market}
            showCommandCenterLink={showCommandCenterLink}
            showInviteLink={showInviteLinks}
            showCoordinatorName={showCoordinatorName}
            squareConnected={squareConnected}
          />
        ))}
      </ul>
    </section>
  )
}

export function CoordinatorMarketsList({
  activeMarkets,
  archivedMarkets,
  totalRevenueCents,
  squareConnected,
  stripeConnected,
  isAdminView = false,
  mobileIntro = false,
}: CoordinatorMarketsListProps) {
  const totalCount = activeMarkets.length + archivedMarkets.length

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageIntro
        eyebrow="Coordinator portal"
        title={isAdminView ? 'All markets' : 'Your markets'}
        description={
          mobileIntro
            ? 'Use a tablet or desktop for the full booth layout designer. On this device you can review events, applications, and day-of operations.'
            : isAdminView
              ? 'Platform admin view — every coordinator market including drafts. Open event hubs or HubGrid for any market.'
              : 'Browse every market, open event hubs, or jump into HubGrid for a specific market.'
        }
        actions={<PortalRoleBadge portal="coordinator" />}
      />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="marketing-glass-card p-3">
          <p className="text-xs text-muted-foreground">Lifetime payout</p>
          <p className="mt-1 font-semibold tabular-nums">{formatRevenue(totalRevenueCents)}</p>
        </div>
        <div className="marketing-glass-card p-3">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="mt-1 font-medium">
            {squareConnected || stripeConnected ? 'Connected' : 'Setup needed'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'gap-1.5')}>
          <Plus className="h-4 w-4" aria-hidden />
          Native market
        </Link>
        <Link
          href={COORDINATOR_ADVERTISE_PATH}
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
        >
          <Megaphone className="h-4 w-4" aria-hidden />
          Advertise only
        </Link>
        <Link
          href="/coordinator/payment-methods"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5 sm:ml-auto')}
        >
          Payment settings
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Start with an ad listing on Discover or run your full market on PopupHub.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href={COORDINATOR_ADVERTISE_PATH} className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
              <Megaphone className="h-4 w-4" aria-hidden />
              Advertise my market
            </Link>
            <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'gap-1.5')}>
              <Plus className="h-4 w-4" aria-hidden />
              Run on PopupHub
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <MarketSection
            title={`Upcoming & active (${activeMarkets.length})`}
            markets={activeMarkets}
            showCommandCenterLink
            showInviteLinks={!isAdminView}
            showCoordinatorName={isAdminView}
            squareConnected={squareConnected}
          />
          <MarketSection
            title={`Past markets (${archivedMarkets.length})`}
            markets={archivedMarkets}
            showCommandCenterLink={false}
            showCoordinatorName={isAdminView}
            squareConnected={squareConnected}
          />
        </div>
      )}
    </div>
  )
}
