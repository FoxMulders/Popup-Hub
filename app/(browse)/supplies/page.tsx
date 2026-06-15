import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Market Supplies — Popup Hub',
  description:
    'Curated Amazon.ca affiliate picks for market booth gear, displays, tents, and packaging — search supplies for your next pop-up market.',
  path: '/supplies',
})

import { VendorSuppliesSection } from '@/components/vendor/vendor-supplies-section'

export default function MarketSuppliesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Market Supplies</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Stock your booth with tents, displays, packaging, and tools. Search Amazon.ca or browse
          our suggested picks — all links use our affiliate tag at no extra cost to you.
        </p>
      </div>

      <VendorSuppliesSection />
    </div>
  )
}
