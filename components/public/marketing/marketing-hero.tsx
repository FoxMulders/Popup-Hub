import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { HOME_HERO } from '@/lib/marketing/home-hero'

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden marketing-hero-mesh text-white">
      <MarketingHeroBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 lg:pt-28 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
            {HOME_HERO.eyebrow}
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            {HOME_HERO.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            {HOME_HERO.subhead}
          </p>
        </div>
      </div>
      <div className="marketing-section-divider" aria-hidden />
    </section>
  )
}
