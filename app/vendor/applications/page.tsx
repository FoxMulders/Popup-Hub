import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { VendorApplicationsList } from '@/components/vendor/vendor-applications-list'
import type { BoothApplication } from '@/types/database'

async function ApplicationsList({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      event:events(
        id, name, location_name, start_at, end_at, status, cover_image_url,
        cancellation_reason, cancellation_reason_notes
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
    />
  )
}

export default async function VendorApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">My Applications</h1>
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        }
      >
        <ApplicationsList userId={user.id} />
      </Suspense>
    </div>
  )
}
