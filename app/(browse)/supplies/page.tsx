import { VendorSuppliesSection } from '@/components/vendor/vendor-supplies-section'
import { SitePageBand } from '@/components/layout/site-page-band'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Market Supplies — Popup Hub',
  description:
    'Curated Amazon.ca affiliate picks for market booth gear, displays, tents, and packaging — search supplies for your next pop-up market.',
  path: '/supplies',
})

export default function MarketSuppliesPage() {
  return (
    <>
      <SitePageBand
        eyebrow="Resources"
        title="Market supplies"
        description="Stock your booth with tents, displays, packaging, and tools. Search Amazon.ca or browse our suggested picks — affiliate links at no extra cost to you."
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <VendorSuppliesSection />
      </div>
    </>
  )
}
