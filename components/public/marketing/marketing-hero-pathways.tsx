'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, ShieldCheck, Store } from 'lucide-react'
import { goToDiscover } from '@/lib/marketing/browse-discover'
import { COORDINATOR_SIGNUP_HREF, HOME_HERO } from '@/lib/marketing/home-hero'
import { VENDOR_OPEN_MARKETS_HREF, VENDOR_PASSPORT_SIGNUP_PREVIEW } from '@/lib/marketing/vendor-journey'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { cn } from '@/lib/utils'

const PATHWAYS = [
  {
    id: 'patron',
    eyebrow: 'Patrons',
    title: 'Plan your market day',
    description: 'Browse dates, see confirmed vendors, and save favorites.',
    cta: 'Browse markets',
    href: '/discover',
    icon: MapPin,
    kind: 'browse' as const,
    emphasized: false,
  },
  {
    id: 'vendor',
    eyebrow: 'Vendors',
    title: 'Apply with your passport',
    description: 'One profile for open and juried markets — verify organizers first.',
    cta: TRUST_DIRECTORY_LINKS.check.ctaOpen,
    href: TRUST_DIRECTORY_LINKS.check.href,
    icon: ShieldCheck,
    kind: 'link' as const,
    emphasized: false,
  },
  {
    id: 'organizer',
    eyebrow: 'Organizers',
    title: 'Run the whole market',
    description: 'Applications, HubGrid layouts, check-in, and patron discovery.',
    cta: 'Start hosting a market',
    href: COORDINATOR_SIGNUP_HREF,
    icon: CalendarDays,
    kind: 'link' as const,
    emphasized: true,
  },
] as const

function PathwayCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  emphasized,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  icon: typeof CalendarDays
  emphasized: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl border p-5 text-left backdrop-blur-sm transition-colors',
        emphasized
          ? 'border-white/35 bg-white/15 shadow-[0_8px_32px_rgb(0_0_0_/_0.12)]'
          : 'border-white/20 bg-white/10 hover:bg-white/12'
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{eyebrow}</span>
      <span
        className={cn(
          'mt-3 inline-flex h-10 w-10 items-center justify-center rounded-xl',
          emphasized ? 'bg-white/20 text-white' : 'bg-white/10 text-harvest-100'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-base font-bold leading-snug text-white sm:text-lg">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function MarketingHeroPathways() {
  const router = useRouter()

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {PATHWAYS.map((path) => {
          if (path.kind === 'browse') {
            return (
              <PathwayCard key={path.id} {...path}>
                <button
                  type="button"
                  onClick={() => goToDiscover(router)}
                  className="marketing-pill marketing-pill--secondary inline-flex min-h-11 w-full gap-2"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  {path.cta}
                </button>
              </PathwayCard>
            )
          }

          return (
            <PathwayCard key={path.id} {...path}>
              <Link
                href={path.href}
                className="marketing-pill marketing-pill--secondary inline-flex min-h-11 w-full gap-2 justify-center"
                title={path.id === 'vendor' ? TRUST_DIRECTORY_LINKS.check.tagline : undefined}
              >
                <path.icon className="h-4 w-4" aria-hidden />
                {path.cta}
              </Link>
              {path.id === 'organizer' ? (
                <Link
                  href="/for-organizers"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white hover:underline underline-offset-2"
                >
                  <Store className="h-3 w-3" aria-hidden />
                  See organizer software →
                </Link>
              ) : null}
              {path.id === 'vendor' ? (
                <>
                  <ul className="mt-3 space-y-1 text-[11px] text-white/70">
                    {VENDOR_PASSPORT_SIGNUP_PREVIEW.steps.map((step, index) => (
                      <li key={step.title}>
                        {index + 1}. {step.title}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup?role=vendor"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white hover:underline underline-offset-2"
                  >
                    Or create vendor account →
                  </Link>
                  <Link
                    href={VENDOR_OPEN_MARKETS_HREF}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white hover:underline underline-offset-2"
                  >
                    See open markets first →
                  </Link>
                </>
              ) : null}
            </PathwayCard>
          )
        })}
      </div>
      <p className="text-center text-xs font-medium leading-relaxed text-white/65 sm:text-sm">
        {HOME_HERO.vendorTrustNote}
      </p>
    </div>
  )
}
