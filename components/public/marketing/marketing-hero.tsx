import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { MarketingHeroActions } from '@/components/public/marketing/marketing-hero-actions'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden marketing-hero-mesh text-white">
      <MarketingHeroBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-harvest-200" aria-hidden />
            Edmonton &amp; Alberta makers markets
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {TRUST_DIRECTORY_LINKS.check.boothFeeHeadline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Search market organizers in the Edmonton area — official links, verified scam alerts, and
            vendor reviews before you send booth fees.
          </p>
          <MarketingHeroActions />
        </div>
        <p className="mt-10 text-center text-xs font-medium tracking-wide text-white/60">
          Built in Canada by people who vend at weekend markets and organize them too
        </p>
      </div>
      <div className="marketing-section-divider" aria-hidden />
    </section>
  )
}
