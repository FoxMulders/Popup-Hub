import Link from 'next/link'
import { ClipboardCheck, LayoutGrid, MapPin, ShieldCheck, Store, Wallet } from 'lucide-react'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

const FEATURES = [
  {
    icon: MapPin,
    title: 'Patron discovery map',
    description:
      'Published markets appear on Popup Hub with dates, locations, and confirmed vendor counts before shoppers arrive.',
  },
  {
    icon: ClipboardCheck,
    title: 'Vendor applications',
    description:
      'Open and juried workflows — vendors apply with their passport; organizers approve, waitlist, or decline from one board.',
  },
  {
    icon: LayoutGrid,
    title: 'Booth layout designer',
    description:
      'Traffic-aware floor plans, printable maps, and live spatial editing — not a spreadsheet of booth numbers.',
  },
  {
    icon: Wallet,
    title: 'Booth fees & payouts',
    description:
      'Collect payments at checkout with transparent platform fees you can pass through to vendors.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & verification',
    description:
      'Check organizers before paying booth fees — vendor reviews, scam alerts, and community mentions in one place.',
    href: TRUST_DIRECTORY_LINKS.check.href,
  },
  {
    icon: Store,
    title: 'Market day operations',
    description:
      'Check-in, live ops, and quarter auctions — tools for the day-of, not just the signup form.',
  },
] as const

export function MarketingFeatures() {
  return (
    <section className="border-y border-stone-200/60 bg-linen px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">Platform</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            One hub for the full market lifecycle
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Popup Hub is market management software — not generic event ticketing. Built for recurring
            pop-ups, makers markets, and artisan fairs.
          </p>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, ...rest }) => {
            const href = 'href' in rest ? rest.href : undefined
            const inner = (
              <>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                {href ? (
                  <span className="mt-3 inline-flex text-sm font-semibold text-forest group-hover:underline">
                    Check organizers →
                  </span>
                ) : null}
              </>
            )

            return (
              <li key={title}>
                {href ? (
                  <Link
                    href={href}
                    className="marketing-glass-card group flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-market-hover)]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="marketing-glass-card flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-market-hover)]">
                    {inner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
