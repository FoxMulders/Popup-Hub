import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DiscoverScreen } from '@/components/shopper/discover-screen'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getCachedApprovedVendorCounts,
  getCachedActiveAuctionIdsByEvent,
  getCachedDiscoverMarkets,
} from '@/lib/queries/cached-public-markets'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Discover Markets',
  description: 'Discover upcoming popup markets near you — see confirmed vendors before you go.',
  path: '/discover',
})

export const revalidate = 60

async function DiscoverContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [events, vendorCounts, activeAuctionByEventId] = await Promise.all([
    getCachedDiscoverMarkets(),
    getCachedApprovedVendorCounts(),
    getCachedActiveAuctionIdsByEvent(),
  ])

  let favoriteIds: string[] = []
  let followVendorIds: string[] = []
  if (user) {
    const [{ data: favs }, { data: follows }] = await Promise.all([
      supabase
        .from('shopper_favorites')
        .select('event_id')
        .eq('user_id', user.id),
      supabase.from('vendor_follows').select('vendor_id').eq('user_id', user.id),
    ])
    favoriteIds = (favs ?? []).map((f) => f.event_id)
    followVendorIds = (follows ?? []).map((f) => f.vendor_id)
  }

  return (
    <DiscoverScreen
      events={events}
      vendorCounts={vendorCounts}
      favoriteIds={favoriteIds}
      followVendorIds={followVendorIds}
      activeAuctionByEventId={activeAuctionByEventId}
      marketAlertsHref={
        user ? '/profile' : '/signup?role=vendor&next=%2Fprofile'
      }
    />
  )
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      }
    >
      <DiscoverContent />
    </Suspense>
  )
}
