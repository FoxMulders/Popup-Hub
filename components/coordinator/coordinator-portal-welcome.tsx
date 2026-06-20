import { LayoutGrid, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoordinatorPortalWelcomeProps {
  className?: string
}

/** Soft bridge from marketing site into coordinator app chrome. */
export function CoordinatorPortalWelcome({ className }: CoordinatorPortalWelcomeProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-forest/15 bg-gradient-to-br from-sage-50 via-white to-harvest-50/40 px-5 py-5 sm:px-6',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-forest/5 blur-2xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-forest">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Coordinator workspace
          </p>
          <p className="mt-1 text-base font-semibold text-foreground sm:text-lg">
            Plan layouts, approve vendors, and publish to Discover
          </p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Popup Hub keeps your floor plan, vendor ledger, and shopper map in sync — start with a
            demo market or claim your HubGuard listing if you already run a market.
          </p>
        </div>
        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
          <LayoutGrid className="h-6 w-6" aria-hidden />
        </div>
      </div>
    </div>
  )
}
