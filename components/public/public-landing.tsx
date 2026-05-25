import { LandingAudienceCards, LandingHeroActions } from '@/components/public/landing-audience-nav'

export function PublicLanding() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-stone-200 bg-gradient-to-b from-sage-50 to-cream">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">Local area markets</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
            Discover local makers markets near you
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Discover upcoming pop-up markets, meet vendors, and plan your weekend — no account required.
          </p>
          <LandingHeroActions />
        </div>
      </section>

      <LandingAudienceCards />
    </div>
  )
}
