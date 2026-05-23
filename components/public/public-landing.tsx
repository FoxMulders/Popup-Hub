import Link from 'next/link'
import { MapPin, Store, CalendarDays } from 'lucide-react'

export function PublicLanding() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-stone-200 bg-gradient-to-b from-sage-50 to-cream">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">Edmonton-area popup markets</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
            Discover local makers markets near you
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Browse upcoming pop-up markets, meet vendors, and plan your weekend — no account required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/discover"
              className="btn-tactile inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-6 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-market-lift)] hover:bg-forest-deep"
            >
              <MapPin className="h-4 w-4" />
              Browse markets
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center rounded-lg border-2 border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-canvas"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <MapPin className="h-8 w-8 text-harvest-500" />
          <h2 className="mt-3 font-heading text-lg font-semibold">For shoppers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            See dates, locations, and confirmed vendor lineups before you go.
          </p>
          <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-forest hover:underline">
            Discover markets →
          </Link>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <Store className="h-8 w-8 text-harvest-500" />
          <h2 className="mt-3 font-heading text-lg font-semibold">For vendors</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Organizers invite vendors directly — build your passport and apply for booths after
            activation.
          </p>
          <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-forest hover:underline">
            Find an organizer →
          </Link>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <CalendarDays className="h-8 w-8 text-harvest-500" />
          <h2 className="mt-3 font-heading text-lg font-semibold">For organizers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Run applications, layouts, check-in, and payouts from one coordinator hub.
          </p>
          <Link
            href="/coordinator/events/new"
            className="mt-4 inline-block text-sm font-semibold text-forest hover:underline"
          >
            Host a market →
          </Link>
        </div>
      </section>
    </div>
  )
}
