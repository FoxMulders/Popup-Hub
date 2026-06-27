import Link from 'next/link'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

export function MarketingCtaBand() {
  return (
    <section className="bg-gradient-to-br from-forest via-forest-deep to-forest px-4 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to find your next market — or run one?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/75 sm:text-base">
          Browse events as a guest, apply with a free vendor passport, or publish your market and
          replace spreadsheet chaos with one coordinator hub.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href="/discover" className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto">
            Discover markets
          </Link>
          <Link href="/for-vendors" className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
            Vendor passport
          </Link>
          <Link
            href="/for-organizers"
            className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
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
