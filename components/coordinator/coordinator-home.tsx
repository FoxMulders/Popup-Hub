import { PageIntro } from '@/components/layout/page-intro'
import Link from 'next/link'
import { CalendarDays, LayoutDashboard, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { CoordinatorGettingStarted } from '@/components/coordinator/coordinator-getting-started'
import { CoordinatorOrganizerClaimSuggestions } from '@/components/coordinator/coordinator-organizer-claim-suggestions'
import { CoordinatorPaymentReadinessCallout } from '@/components/coordinator/coordinator-payment-readiness-callout'
import { CoordinatorPortalWelcome } from '@/components/coordinator/coordinator-portal-welcome'
import { DemoMarketLauncher } from '@/components/coordinator/demo-market-launcher'
import type { OrganizerClaimSuggestion } from '@/lib/organizers/match-coordinator-organizers'
import { cn } from '@/lib/utils'

interface CoordinatorHomeProps {
  displayName: string | null
  marketCount: number
  claimSuggestions?: OrganizerClaimSuggestion[]
  showPaymentReadiness?: boolean
  organizationName?: string | null
  squareConnected?: boolean
  stripeConnected?: boolean
}

export function CoordinatorHome({
  displayName,
  marketCount,
  claimSuggestions = [],
  showPaymentReadiness = false,
  organizationName = null,
  squareConnected = false,
  stripeConnected = false,
}: CoordinatorHomeProps) {
  const greeting = displayName?.trim() ? `Welcome back, ${displayName.trim()}` : 'Welcome back'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <PageIntro
        eyebrow="Coordinator portal"
        title={greeting}
        description={
          marketCount > 0
            ? `You have ${marketCount} market${marketCount === 1 ? '' : 's'}. Start a new one or browse them all.`
            : 'Create your first market or return here anytime to pick up where you left off.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PortalRoleBadge portal="coordinator" />
            {marketCount > 0 ? <DemoMarketLauncher size="sm" variant="outline" /> : null}
          </div>
        }
      />

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

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Link
          href="/coordinator/markets"
          className="marketing-glass-card group flex flex-col p-6 text-left transition-all hover:shadow-[var(--shadow-market-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest/10 text-forest transition-colors group-hover:bg-forest/15">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 text-lg font-bold text-foreground">
            View your markets
          </span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Browse your markets, open event hubs, and jump into layout or day-of tools per market.
          </span>
          <span className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 w-full gap-1.5 sm:w-auto')}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            {marketCount > 0 ? `Browse all markets (${marketCount})` : 'Browse markets'}
          </span>
        </Link>
      </div>
    </div>
  )
}
