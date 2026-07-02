import Link from 'next/link'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { COORDINATOR_ADVERTISE_SIGNUP_HREF } from '@/lib/marketing/home-hero'

export function MarketingCtaBand() {
  return (
    <section className="bg-gradient-to-br from-forest via-forest-deep to-forest px-4 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to find your next market — or run one?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/75 sm:text-base">
          Browse events as a guest, apply with a free vendor passport, advertise your market on
          Discover, or publish and run booth ops in one coordinator hub.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/discover" className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto">
            Discover markets
          </Link>
          <Link
            href={COORDINATOR_ADVERTISE_SIGNUP_HREF}
            className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto"
          >
            Advertise your market
          </Link>
          <Link href="/for-vendors" className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto">
            Vendor passport
          </Link>
          <Link
            href="/for-organizers"
            className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto"
          >
            Run a market
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <Link
            href={TRUST_DIRECTORY_LINKS.check.href}
            className="font-medium text-white/80 hover:text-white hover:underline underline-offset-2"
            title={TRUST_DIRECTORY_LINKS.check.tagline}
          >
            {TRUST_DIRECTORY_LINKS.check.label} — verify before you pay →
          </Link>
          <Link
            href="/legal/guides"
            className="font-medium text-white/80 hover:text-white hover:underline underline-offset-2"
          >
            Market guides →
          </Link>
        </div>
      </div>
    </section>
  )
}
