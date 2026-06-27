import { SitePageBand } from '@/components/layout/site-page-band'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { CoordinatorGettingStarted } from '@/components/coordinator/coordinator-getting-started'
import { CoordinatorOrganizerClaimSuggestions } from '@/components/coordinator/coordinator-organizer-claim-suggestions'
import { CoordinatorPaymentReadinessCallout } from '@/components/coordinator/coordinator-payment-readiness-callout'
import { CoordinatorPortalWelcome } from '@/components/coordinator/coordinator-portal-welcome'
import { DemoMarketLauncher } from '@/components/coordinator/demo-market-launcher'
import { VendorInviteCopyButton } from '@/components/coordinator/vendor-invite-copy-button'
import type { OrganizerClaimSuggestion } from '@/lib/organizers/match-coordinator-organizers'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import { cn } from '@/lib/utils'

export interface CoordinatorHomeMarket {
  id: string
  name: string
  start_at: string
  status: string
}

interface CoordinatorHomeProps {
  displayName: string | null
  marketCount: number
  recentMarkets?: CoordinatorHomeMarket[]
  claimSuggestions?: OrganizerClaimSuggestion[]
  showPaymentReadiness?: boolean
  organizationName?: string | null
  squareConnected?: boolean
  stripeConnected?: boolean
}

function statusLabel(status: string): string {
  if (status === 'draft') return 'Draft'
  if (status === 'published') return 'Published'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

export function CoordinatorHome({
  displayName,
  marketCount,
  recentMarkets = [],
  claimSuggestions = [],
  showPaymentReadiness = false,
  organizationName = null,
  squareConnected = false,
  stripeConnected = false,
}: CoordinatorHomeProps) {
  const greeting = displayName?.trim() ? `Welcome back, ${displayName.trim()}` : 'Welcome back'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <SitePageBand
        tone="subtle"
        eyebrow="Coordinator portal"
        title={greeting}
        description={
          marketCount > 0
            ? `You have ${marketCount} market${marketCount === 1 ? '' : 's'}. Open one below or start a new one.`
            : 'Create your first market or return here anytime to pick up where you left off.'
        }
        className="-mx-4 sm:-mx-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <PortalRoleBadge portal="coordinator" />
          {marketCount > 0 ? <DemoMarketLauncher size="sm" variant="outline" /> : null}
        </div>
      </SitePageBand>

      {marketCount === 0 ? <CoordinatorPortalWelcome /> : null}

      {claimSuggestions.length > 0 ? (
        <CoordinatorOrganizerClaimSuggestions suggestions={claimSuggestions} />
      ) : null}

      {showPaymentReadiness ? (
        <CoordinatorPaymentReadinessCallout
          organizationName={organizationName}
          squareConnected={squareConnected}
          stripeConnected={stripeConnected}
        />
      ) : null}

      {marketCount === 0 ? <CoordinatorGettingStarted /> : null}

      {marketCount > 0 && recentMarkets.length > 0 ? (
        <section className="space-y-3" aria-labelledby="coordinator-home-markets">
          <h2
            id="coordinator-home-markets"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Your markets
          </h2>
          <ul className="flex flex-col gap-2" role="list">
            {recentMarkets.map((market) => (
              <li
                key={market.id}
                className="marketing-glass-card overflow-hidden transition-colors hover:border-forest/30"
              >
                <Link
                  href={`/coordinator/events/${market.id}`}
                  className="flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
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
                <div className="border-t border-stone-200/80 px-4 py-2.5">
                  <VendorInviteCopyButton
                    eventId={market.id}
                    eventName={market.name}
                    className="w-full sm:w-auto"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-1">
        <Link
          href="/coordinator/events/new"
          className="marketing-glass-card group flex flex-col p-6 text-left transition-all hover:shadow-[var(--shadow-market-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-900 transition-colors group-hover:bg-sky-200/80">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 text-lg font-bold text-foreground">
            Create a new market
          </span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Set up dates, venue, booth pricing, and your floor plan from the setup wizard.
          </span>
          <span className={cn(buttonVariants(), 'mt-5 w-full sm:w-auto')}>Start setup</span>
        </Link>
      </div>
    </div>
  )
}
