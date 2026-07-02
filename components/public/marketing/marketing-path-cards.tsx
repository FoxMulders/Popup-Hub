'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Store } from 'lucide-react'
import { goToDiscover } from '@/lib/marketing/browse-discover'
import {
  COORDINATOR_ADVERTISE_SIGNUP_HREF,
  COORDINATOR_SIGNUP_HREF,
} from '@/lib/marketing/home-hero'
import { VENDOR_OPEN_MARKETS_HREF, VENDOR_PASSPORT_SIGNUP_PREVIEW } from '@/lib/marketing/vendor-journey'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { cn } from '@/lib/utils'

const PATHS = [
  {
    href: '/discover',
    icon: MapPin,
    eyebrow: 'Patrons',
    title: 'Plan your market day',
    description:
      'Browse upcoming events, see confirmed vendors on the map, and save favorites — no account required to explore.',
    cta: 'Discover markets',
    accent: 'from-sage-50 to-cream border-sage-200/80 hover:border-sage-400/50',
    iconClass: 'bg-sage-100 text-sage-800',
    useDiscoverNav: true,
  },
  {
    href: '/for-vendors',
    icon: Store,
    eyebrow: 'Vendors',
    title: 'Apply with your passport',
    description:
      'Use HubGuard before paying booth fees, then build a vendor profile once and apply to open or juried markets.',
    cta: 'Vendor hub',
    secondaryHref: TRUST_DIRECTORY_LINKS.check.href,
    secondaryLabel: `Or open ${TRUST_DIRECTORY_LINKS.check.label} first`,
    tertiaryHref: VENDOR_OPEN_MARKETS_HREF,
    tertiaryLabel: 'See open markets without signing up',
    accent: 'from-harvest-50/80 to-cream border-harvest-200/70 hover:border-harvest-400/50',
    iconClass: 'bg-harvest-100 text-harvest-800',
    showVendorSteps: true,
  },
  {
    href: '/for-organizers',
    icon: CalendarDays,
    eyebrow: 'Organizers',
    title: 'Run or advertise your market',
    description:
      'List on Discover with a click-through ad, or run the full stack — applications, booth layouts, check-in, and patron discovery.',
    cta: 'Organizer software',
    secondaryHref: COORDINATOR_ADVERTISE_SIGNUP_HREF,
    secondaryLabel: 'Advertise on Discover only',
    tertiaryHref: COORDINATOR_SIGNUP_HREF,
    tertiaryLabel: 'Run natively on PopupHub',
    accent: 'from-canvas to-cream border-stone-200/80 hover:border-forest/30',
    iconClass: 'bg-forest/10 text-forest',
  },
] as const

const cardClass =
  'group flex flex-col rounded-2xl border bg-gradient-to-br p-6 text-left shadow-[var(--shadow-market)] transition-all duration-200 hover:shadow-[var(--shadow-market-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 touch-manipulation'

function PathCardContent({
  eyebrow,
  icon: Icon,
  title,
  description,
  cta,
  iconClass,
  secondaryHref,
  secondaryLabel,
  tertiaryHref,
  tertiaryLabel,
  showVendorSteps,
}: {
  eyebrow: string
  icon: typeof MapPin
  title: string
  description: string
  cta: string
  iconClass: string
  secondaryHref?: string
  secondaryLabel?: string
  tertiaryHref?: string
  tertiaryLabel?: string
  showVendorSteps?: boolean
}) {
  return (
    <>
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </span>
      <span
        className={cn(
          'mt-4 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
          iconClass
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {showVendorSteps ? (
        <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
          {VENDOR_PASSPORT_SIGNUP_PREVIEW.steps.map((step, index) => (
            <li key={step.title}>
              <span className="font-medium text-foreground">
                {index + 1}. {step.title}
              </span>
              {' — '}
              {step.detail}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-5 space-y-2">
        <span className="inline-flex items-center text-sm font-semibold text-forest group-hover:underline">
          {`${cta} →`}
        </span>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="block text-xs font-medium text-muted-foreground hover:text-forest hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {secondaryLabel} →
          </Link>
        ) : null}
        {tertiaryHref && tertiaryLabel ? (
          <Link
            href={tertiaryHref}
            className="block text-xs font-medium text-muted-foreground hover:text-forest hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {tertiaryLabel} →
          </Link>
        ) : null}
      </div>
    </>
  )
}

export function MarketingPathCards() {
  const router = useRouter()

  return (
    <section className="bg-cream px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Three ways into Popup Hub
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Whether you&apos;re browsing, vending, or organizing — pick the path that fits.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PATHS.map((path) => {
            const className = cn(cardClass, path.accent)

            if ('useDiscoverNav' in path && path.useDiscoverNav) {
              return (
                <button
                  key={path.href}
                  type="button"
                  onClick={() => goToDiscover(router)}
                  className={className}
                >
                  <PathCardContent {...path} />
                </button>
              )
            }

            return (
              <Link key={path.href} href={path.href} className={className}>
                <PathCardContent {...path} />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
