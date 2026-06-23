import { SitePageBand } from '@/components/layout/site-page-band'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { VendorMarketGrid } from '@/components/vendor/vendor-market-grid'
import { VendorAlertOnboarding } from '@/components/vendor/vendor-alert-onboarding'
import { VendorCheckOrganizerCallout } from '@/components/check/vendor-check-organizer-callout'
import {
  filterVendorParticipatedArchivedEvents,
  partitionEventsByPhase,
  sortEventsByStartAsc,
  sortEventsByStartDesc,
} from '@/lib/queries/events'
import {
  getCachedVendorDirectoryCapacitySummaries,
  getCachedVendorDirectoryMarkets,
} from '@/lib/queries/cached-public-markets'
import type { ApplicationStatus, Event } from '@/types/database'
import { redirect } from 'next/navigation'

export const revalidate = 60

async function VendorMarkets({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [events, capacityByEventId, { data: myApplications }] = await Promise.all([
    getCachedVendorDirectoryMarkets(),
    getCachedVendorDirectoryCapacitySummaries(),
    supabase.from('booth_applications').select('id, event_id, status').eq('vendor_id', userId),
  ])

  const { active, archived } = partitionEventsByPhase(events as Event[])

  const applicationsByEventId = Object.fromEntries(
    (myApplications ?? []).map((row) => [
      row.event_id,
      { id: row.id, status: row.status as ApplicationStatus },
    ]),
  ) as Record<string, { id: string; status: ApplicationStatus }>

  const vendorArchived = filterVendorParticipatedArchivedEvents(
    archived,
    Object.keys(applicationsByEventId),
  )

  return (
    <VendorMarketGrid
      activeEvents={sortEventsByStartAsc(active)}
      archivedEvents={sortEventsByStartDesc(vendorArchived)}
      userId={userId}
      applicationsByEventId={applicationsByEventId}
      capacityByEventId={capacityByEventId}
    />
  )
}

export default async function VendorEventsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-7xl">
      <SitePageBand
        tone="subtle"
        eyebrow="Vendor portal"
        title="Apply for open markets"
        description="All published markets — apply anytime. Browse every open listing or optionally narrow by distance."
        className="-mx-4 mb-6 sm:-mx-6 lg:-mx-8 xl:-mx-16 px-0"
      />
      <div className="px-0">
      <VendorCheckOrganizerCallout />
      <VendorAlertOnboarding />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        }
      >
        <VendorMarkets userId={user.id} />
      </Suspense>
      </div>
    </div>
  )
}

