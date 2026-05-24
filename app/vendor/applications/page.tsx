import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { VendorApplicationsList } from '@/components/vendor/vendor-applications-list'
import type { VendorApplicationFilter } from '@/lib/vendor/application-status-ui'
import type { BoothApplication } from '@/types/database'

const VALID_FILTERS = new Set<VendorApplicationFilter>([
  'all',
  'active',
  'pending',
  'approved',
  'waitlisted',
  'closed',
])

async function ApplicationsList({
  userId,
  initialFilter,
}: {
  userId: string
  initialFilter: VendorApplicationFilter
}) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      event:events(
        id, name, location_name, start_at, end_at, status, cover_image_url, booking_mode,
        cancellation_reason, cancellation_reason_notes,
        coordinator:profiles!events_coordinator_id_fkey(id, full_name, email, avatar_url)
      ),
      category:categories(name)
    `)
    .eq('vendor_id', userId)
    .order('applied_at', { ascending: false })

  const eventIds = [...new Set((applications ?? []).map((a) => a.event_id))]
  const categoryPrices: Record<string, number> = {}

  if (eventIds.length > 0) {
    const { data: limits } = await supabase
      .from('event_category_limits')
      .select('event_id, category_id, price_per_booth')
      .in('event_id', eventIds)

    for (const limit of limits ?? []) {
      categoryPrices[`${limit.event_id}:${limit.category_id}`] = limit.price_per_booth
    }
  }

  return (
    <VendorApplicationsList
      applications={(applications ?? []) as BoothApplication[]}
      categoryPrices={categoryPrices}
      userId={userId}
      initialFilter={initialFilter}
    />
  )
}

export default async function VendorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const initialFilter = VALID_FILTERS.has(params.filter as VendorApplicationFilter)
    ? (params.filter as VendorApplicationFilter)
    : 'all'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold text-foreground">My Applications</h1>
        <p className="text-sm text-muted-foreground">
          Track every market you applied to, see juried review status, and follow up with organizers.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        }
      >
        <ApplicationsList userId={user.id} initialFilter={initialFilter} />
      </Suspense>
    </div>
  )
}
