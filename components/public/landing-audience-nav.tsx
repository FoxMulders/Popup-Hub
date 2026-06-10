'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, MapPin, Store } from 'lucide-react'
import { requestUserLocation } from '@/lib/markets/user-location'

const AUDIENCE_CARDS = [
  {
    href: '/discover',
    icon: MapPin,
    title: 'For shoppers',
    description: 'See dates, locations, and confirmed vendor lineups before you go.',
    cta: 'Discover markets',
  },
  {
    href: '/signup?role=vendor',
    icon: Store,
    title: 'For vendors',
    description:
      'Create a vendor account, build your passport, and apply to open markets. Juried events review each application.',
    cta: 'Sign up as a vendor',
  },
  {
    href: '/signup?role=coordinator',
    icon: CalendarDays,
    title: 'For organizers',
    description: 'Run applications, layouts, check-in, and payouts from one coordinator hub.',
    cta: 'Host a market',
  },
] as const

export function LandingHeroActions() {
  const router = useRouter()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)

  async function goWithLocation(href: string) {
    setLoadingHref(href)
    await requestUserLocation()
    router.push(href)
    setLoadingHref(null)
  }

  return (
    <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => void goWithLocation('/discover')}
        disabled={loadingHref !== null}
        className="btn-tactile inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-forest px-8 py-3 text-base font-semibold text-white shadow-[var(--shadow-market-lift)] hover:bg-forest-deep disabled:opacity-70 touch-manipulation sm:w-auto"
      >
        {loadingHref === '/discover' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MapPin className="h-4 w-4" />
        )}
        Browse Markets
      </button>
      <Link
        href="/login"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-stone-200 bg-white px-8 py-3 text-base font-semibold text-foreground hover:bg-canvas touch-manipulation sm:w-auto"
      >
        Sign In
      </Link>
    </div>
  )
}

export function LandingAudienceCards() {
  const router = useRouter()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)

  async function handleSelect(href: string) {
    setLoadingHref(href)
    await requestUserLocation()
    router.push(href)
    setLoadingHref(null)
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
      {AUDIENCE_CARDS.map(({ href, icon: Icon, title, description, cta }) => {
        const loading = loadingHref === href
        return (
          <button
            key={href}
            type="button"
            disabled={loadingHref !== null}
            onClick={() => void handleSelect(href)}
            className="group flex min-h-[11rem] flex-col rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:border-forest/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-70 touch-manipulation"
          >
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-harvest-500" />
            ) : (
              <Icon className="h-8 w-8 text-harvest-500 transition group-hover:text-forest" />
            )}
            <h2 className="mt-3 font-heading text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
            <span className="mt-4 inline-flex items-center text-sm font-semibold text-forest group-hover:underline">
              {loading ? 'Getting your location…' : `${cta} →`}
            </span>
          </button>
        )
      })}
    </section>
  )
}
