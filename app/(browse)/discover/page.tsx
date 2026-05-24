import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DiscoverScreen } from '@/components/shopper/discover-screen'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getCachedApprovedVendorCounts,
  getCachedDiscoverMarkets,
} from '@/lib/queries/cached-public-markets'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Discover Markets — Popup Hub',
  description: 'Browse upcoming popup markets near you — see vendors before you go.',
}

export const revalidate = 60

async function DiscoverContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [events, vendorCounts] = await Promise.all([
    getCachedDiscoverMarkets(),
    getCachedApprovedVendorCounts(),
  ])

  let favoriteIds: string[] = []
  if (user) {
    const { data: favs } = await supabase
      .from('shopper_favorites')
      .select('event_id')
      .eq('user_id', user.id)
    favoriteIds = (favs ?? []).map((f) => f.event_id)
  }

  return (
    <DiscoverScreen
      events={events}
      vendorCounts={vendorCounts}
      favoriteIds={favoriteIds}
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
