import Link from 'next/link'
import { ArrowRight, BarChart3, Megaphone, MousePointerClick } from 'lucide-react'
import { COORDINATOR_ADVERTISE_SIGNUP_HREF } from '@/lib/marketing/home-hero'
import { cn } from '@/lib/utils'

const MOCK_STATS = [
  { label: 'Discover listing', value: 'Live on map' },
  { label: 'Click tracking', value: 'Daily analytics' },
  { label: 'Native upgrade', value: 'Free in beta' },
] as const

export function MarketingAdvertiseMarketPromo() {
  return (
    <section
      className="px-4 py-10 sm:py-12"
      aria-labelledby="advertise-market-promo-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-harvest-50/60 shadow-[var(--shadow-market-md)]">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-harvest-200/25 blur-3xl"
            aria-hidden
          />

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(260px,320px)] lg:items-center lg:gap-10 lg:p-10">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-950">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Ad listing
              </p>
              <h2
                id="advertise-market-promo-heading"
                className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              >
                Advertise your market on Popup Hub Discover
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                You don&apos;t need to run booth layout or vendor intake on Popup Hub to get found.
                List your market on our discovery map with a trackable link to your website — then
                upgrade to native tools whenever you&apos;re ready.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  Shoppers discover your event on the patron map
                </li>
                <li className="flex gap-2">
                  <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  Track click-throughs to your site from one dashboard
                </li>
                <li className="flex gap-2">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  Upgrade to HubGrid, applications, and payouts free during beta
                </li>
              </ul>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={COORDINATOR_ADVERTISE_SIGNUP_HREF}
                  className={cn(
                    'marketing-pill marketing-pill--primary inline-flex min-h-11 items-center justify-center gap-2 px-6',
                    'bg-[#FF6B35] text-white hover:bg-[#e85f2f]'
                  )}
                >
                  Advertise your market
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/for-organizers"
                  className="text-sm font-semibold text-forest hover:underline"
                >
                  Compare ad listing vs native hosting →
                </Link>
              </div>
            </div>

            <div className="marketing-glass-card relative overflow-hidden border-amber-200/60 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Preview
              </p>
              <div className="mt-3 rounded-xl border border-stone-200/90 bg-gradient-to-b from-sage-50/80 to-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-forest">On Discover</p>
                    <p className="mt-1 text-sm font-bold text-foreground">Your Makers Market</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Sat, Aug 16 · Community hall</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    Ad listing
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-amber-300/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
                  <span className="font-medium">yourmarket.ca</span>
                  <MousePointerClick className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {MOCK_STATS.map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-stone-50 px-2 py-2 text-center">
                    <dt className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[11px] font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
