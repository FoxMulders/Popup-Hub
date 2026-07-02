import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MarketingIntentComparison } from '@/components/public/marketing/marketing-intent-comparison'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'

export function CompareLanding() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden marketing-hero-mesh text-white">
        <MarketingHeroBackdrop />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pb-12 sm:pt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href="/discover"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              Browse markets as a shopper
            </Link>
            <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
              For event coordinators
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            A structural breakdown of where your marketing budget actually goes — and why intent-driven
            discovery beats passive impressions.
          </p>
        </div>
        <div className="marketing-section-divider" aria-hidden />
      </section>

      <section className="bg-canvas" aria-label="Marketing channel comparison">
        <MarketingIntentComparison />
      </section>
    </main>
  )
}
