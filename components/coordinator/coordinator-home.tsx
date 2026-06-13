import Link from 'next/link'
import { CalendarDays, LayoutDashboard, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { cn } from '@/lib/utils'

interface CoordinatorHomeProps {
  displayName: string | null
  marketCount: number
}

export function CoordinatorHome({ displayName, marketCount }: CoordinatorHomeProps) {
  const greeting = displayName?.trim() ? `Welcome back, ${displayName.trim()}` : 'Welcome back'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="text-center">
        <PortalRoleBadge portal="coordinator" />
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
          {marketCount > 0
            ? `You have ${marketCount} market${marketCount === 1 ? '' : 's'}. Start a new one or open your command center.`
            : 'Create your first market or return here anytime to pick up where you left off.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/coordinator/events/new"
          className="market-panel group flex flex-col rounded-2xl border border-stone-200/80 p-6 text-left transition-colors hover:border-sky-300/80 hover:bg-sky-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-900 transition-colors group-hover:bg-sky-200/80">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 font-heading text-lg font-semibold text-foreground">
            Create a new market
          </span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Set up dates, venue, booth pricing, and your floor plan from the setup wizard.
          </span>
          <span className={cn(buttonVariants(), 'mt-5 w-full sm:w-auto')}>Start setup</span>
        </Link>

        <Link
          href="/coordinator/dashboard"
          className="market-panel group flex flex-col rounded-2xl border border-stone-200/80 p-6 text-left transition-colors hover:border-forest/30 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest/10 text-forest transition-colors group-hover:bg-forest/15">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-4 font-heading text-lg font-semibold text-foreground">
            View your markets
          </span>
          <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Browse your markets, open event hubs, and jump into layout or day-of tools per market.
          </span>
          <span className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 w-full gap-1.5 sm:w-auto')}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            {marketCount > 0 ? `Open command center (${marketCount})` : 'Open command center'}
          </span>
        </Link>
      </div>
    </div>
  )
}
