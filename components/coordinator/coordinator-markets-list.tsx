import Link from 'next/link'
import {
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { PageIntro } from '@/components/layout/page-intro'
import {
  coordinatorStudioHref,
} from '@/lib/coordinator/coordinator-routes'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import { VendorRecruitmentCallout } from '@/components/coordinator/vendor-recruitment-callout'
import { cn } from '@/lib/utils'

export interface CoordinatorMarketSummary {
  id: string
  name: string
  start_at: string
  status: string
}

interface CoordinatorMarketsListProps {
  activeMarkets: CoordinatorMarketSummary[]
  archivedMarkets: CoordinatorMarketSummary[]
  totalRevenueCents: number
  squareConnected: boolean
  stripeConnected: boolean
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

function MarketRow({
  market,
  showCommandCenterLink,
}: {
  market: CoordinatorMarketSummary
  showCommandCenterLink: boolean
}) {
  return (
    <li className="marketing-glass-card transition-colors hover:border-forest/30 hover:shadow-[var(--shadow-market-md)]">
      <div className="flex items-center gap-3 p-4">
        <Link
          href={`/coordinator/events/${market.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-forest">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 font-medium text-foreground">{market.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{safeFormatMarketDate(market.start_at)}</span>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                {statusLabel(market.status)}
              </Badge>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        {showCommandCenterLink ? (
          <Link
            href={coordinatorStudioHref(market.id)}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden shrink-0 gap-1.5 sm:inline-flex'
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            Blueprint Studio
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
      </div>
    </li>
  )
}

function MarketSection({
  title,
  markets,
  showCommandCenterLink,
}: {
  title: string
  markets: CoordinatorMarketSummary[]
  showCommandCenterLink: boolean
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
  mobileIntro = false,
}: CoordinatorMarketsListProps) {
  const totalCount = activeMarkets.length + archivedMarkets.length

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageIntro
        eyebrow="Coordinator portal"
        title="Your markets"
        description={
          mobileIntro
            ? 'Use a tablet or desktop for the full booth layout designer. On this device you can review events, applications, and day-of operations.'
            : 'Browse every market, open event hubs, or jump into Blueprint Studio for a specific market.'
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'gap-1.5')}>
          <Plus className="h-4 w-4" aria-hidden />
          New market
        </Link>
        {activeMarkets.length > 0 ? (
          <Link
            href={coordinatorStudioHref(activeMarkets[0]!.id)}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Open Blueprint Studio
          </Link>
        ) : null}
        <Link
          href="/coordinator/payment-methods"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5 sm:ml-auto')}
        >
          Payment settings
        </Link>
      </div>

      {totalCount > 0 && activeMarkets[0] ? (
        <VendorRecruitmentCallout
          variant="compact"
          eventId={activeMarkets[0].id}
          eventName={activeMarkets[0].name}
          eventStatus={activeMarkets[0].status}
        />
      ) : null}

      {totalCount === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            You have not created a market yet. Start with the setup wizard.
          </p>
          <Link href="/coordinator/events/new" className={cn(buttonVariants(), 'mt-4 gap-1.5')}>
            <Plus className="h-4 w-4" aria-hidden />
            Create your first market
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <MarketSection
            title={`Upcoming & active (${activeMarkets.length})`}
            markets={activeMarkets}
            showCommandCenterLink
          />
          <MarketSection
            title={`Past markets (${archivedMarkets.length})`}
            markets={archivedMarkets}
            showCommandCenterLink={false}
          />
        </div>
      )}
    </div>
  )
}
