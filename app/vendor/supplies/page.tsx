import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VendorSuppliesSection } from '@/components/vendor/vendor-supplies-section'

export const metadata = {
  title: 'Vendor Supplies | PopUp Hub',
  description: 'Search Amazon.ca for market booth gear and packaging with curated vendor suggestions.',
}

export default async function VendorSuppliesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vendor/supplies')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Vendor Supplies</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Stock your booth with tents, displays, packaging, and tools. Search Amazon.ca or browse
          our suggested picks — all links use our affiliate tag at no extra cost to you.
        </p>
      </div>

      <VendorSuppliesSection />
    </div>
  )
}
