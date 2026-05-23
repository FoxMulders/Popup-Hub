import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { VendorMarketGrid } from '@/components/vendor/vendor-market-grid'
import {
  partitionEventsByPhase,
  sortEventsByStartAsc,
  sortEventsByStartDesc,
  VENDOR_EVENT_SELECT,
  VENDOR_MARKET_STATUSES,
} from '@/lib/queries/events'
import type { ApplicationStatus, Event } from '@/types/database'
import { redirect } from 'next/navigation'

async function VendorMarkets({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [{ data: events }, { data: myApplications }] = await Promise.all([
    supabase
      .from('events')
      .select(VENDOR_EVENT_SELECT)
      .in('status', VENDOR_MARKET_STATUSES)
      .order('start_at', { ascending: true }),
    supabase.from('booth_applications').select('event_id, status').eq('vendor_id', userId),
  ])

  const { active, archived } = partitionEventsByPhase((events ?? []) as Event[])

  const applicationStatuses = Object.fromEntries(
    (myApplications ?? []).map((row) => [row.event_id, row.status as ApplicationStatus])
  ) as Record<string, ApplicationStatus>

  return (
    <VendorMarketGrid
      activeEvents={sortEventsByStartAsc(active)}
      archivedEvents={sortEventsByStartDesc(archived)}
      userId={userId}
      applicationStatuses={applicationStatuses}
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Apply for open markets</h1>
        <p className="mt-1 text-gray-500">
          Browse every published market and apply directly — no organizer pre-approval required.
        </p>
      </div>
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
  )
}
