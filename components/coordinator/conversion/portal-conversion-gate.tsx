'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Megaphone, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { FomoFeatureCards } from './fomo-feature-cards'
import { MarketUpgradeButton } from './market-upgrade-button'
import {
  COORDINATOR_ADVERTISE_PATH,
  COORDINATOR_MARKETS_PATH,
} from '@/lib/coordinator/coordinator-routes'
import { COORDINATOR_WELCOME_DISMISSED_COOKIE } from '@/lib/coordinator/conversion-listing'
import { cn } from '@/lib/utils'

export interface PortalConversionGateMarket {
  id: string
  name: string
  isExternalListing: boolean
  adCampaignStatus?: string | null
}

interface PortalConversionGateProps {
  displayName: string | null
  markets: PortalConversionGateMarket[]
  squareConnected?: boolean
  continueHref?: string
}

function dismissWelcomeCookie(): void {
  const maxAge = 60 * 60 * 24 * 90
  document.cookie = `${COORDINATOR_WELCOME_DISMISSED_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function PortalConversionGate({
  displayName,
  markets,
  squareConnected = false,
  continueHref = '/coordinator',
}: PortalConversionGateProps) {
  const router = useRouter()
  const greeting = displayName?.trim() ? `Welcome, ${displayName.trim()}` : 'Welcome to PopupHub'
  const externalMarkets = markets.filter((m) => m.isExternalListing)
  const hasExternalOnly = markets.length > 0 && externalMarkets.length === markets.length
  const primaryExternal = externalMarkets[0]

  const handleContinue = () => {
    dismissWelcomeCookie()
    router.push(continueHref)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-10">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-forest">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Coordinator portal
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{greeting}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          You do not need to run your whole market on PopupHub to get started. Advertise on Discover,
          then upgrade to native tools — booth layout, vendor intake, and payments — whenever you are
          ready. Native upgrade is free during beta.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={COORDINATOR_ADVERTISE_PATH}
          className="marketing-glass-card group flex flex-col p-5 text-left transition hover:shadow-[var(--shadow-market-hover)]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 text-lg font-bold text-foreground">Advertise my market</span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            List on Discover with a click-through link to your site. From $49/mo — beta pricing may
            apply.
          </span>
          <span className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 w-full sm:w-auto')}>
            Start ad listing
          </span>
        </Link>

        <Link
          href="/coordinator/events/new"
          className="marketing-glass-card group flex flex-col p-5 text-left transition hover:shadow-[var(--shadow-market-hover)]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 text-lg font-bold text-foreground">Run on PopupHub</span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Full native market — floor plan, vendor applications, booth payments (3% + $1 per booth).
          </span>
          <span className={cn(buttonVariants(), 'mt-4 w-full sm:w-auto')}>Open setup wizard</span>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What you unlock with native
        </h2>
        <FomoFeatureCards />
      </section>

      {primaryExternal ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-5">
          <h2 className="text-base font-semibold text-foreground">
            {hasExternalOnly ? 'Your ad listing is live' : 'Upgrade an ad listing'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">{primaryExternal.name}</strong> is on the
            ad tier
            {primaryExternal.adCampaignStatus === 'active' ? ' with an active campaign' : ''}. Switch
            to native free to unlock HubGrid and vendor ops.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MarketUpgradeButton
              eventId={primaryExternal.id}
              squareConnected={squareConnected}
              className="sm:w-auto"
            />
            <Link
              href={`/coordinator/events/${primaryExternal.id}/campaign`}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
            >
              View campaign
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-stone-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleContinue}
          className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start px-0 sm:px-4')}
        >
          Continue to portal
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </button>
        <Link
          href={COORDINATOR_MARKETS_PATH}
          className={cn(buttonVariants({ variant: 'link' }), 'text-muted-foreground')}
        >
          Browse all markets
        </Link>
      </div>
    </div>
  )
}
