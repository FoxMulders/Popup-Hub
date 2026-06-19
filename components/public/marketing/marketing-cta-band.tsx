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
          Browse events as a guest, sign up as a vendor, or create a coordinator account and publish
          your first listing.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href="/discover" className="marketing-pill marketing-pill--secondary min-h-12 w-full sm:w-auto">
            Explore markets
          </Link>
          <Link href="/signup" className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
            Create free account
          </Link>
        </div>
        <Link
          href={TRUST_DIRECTORY_LINKS.check.href}
          className="mt-5 inline-flex text-sm font-medium text-white/80 hover:text-white hover:underline underline-offset-2"
          title={TRUST_DIRECTORY_LINKS.check.tagline}
        >
          {TRUST_DIRECTORY_LINKS.check.label} — check organizers before you pay →
        </Link>
      </div>
    </section>
  )
}
