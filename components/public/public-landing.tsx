import { MarketingAdvertiseMarketPromo } from '@/components/public/marketing/marketing-advertise-market-promo'
import { MarketingCtaBand } from '@/components/public/marketing/marketing-cta-band'
import { MarketingFeatures } from '@/components/public/marketing/marketing-features'
import { MarketingHero } from '@/components/public/marketing/marketing-hero'
import { MarketingLocalMarketsSection } from '@/components/public/marketing/marketing-local-markets-section'
import { MarketingPathCards } from '@/components/public/marketing/marketing-path-cards'
import { MarketingSplitStory } from '@/components/public/marketing/marketing-split-story'
import { MarketingTestimonial } from '@/components/public/marketing/marketing-testimonial'

export function PublicLanding() {
  return (
    <main className="flex flex-1 flex-col">
      <MarketingHero />
      <MarketingPathCards />
      <MarketingAdvertiseMarketPromo />
      <MarketingLocalMarketsSection />
      <MarketingFeatures />
      <MarketingSplitStory />
      <MarketingTestimonial />
      <MarketingCtaBand />
    </main>
  )
}
