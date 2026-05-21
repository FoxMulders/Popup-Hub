import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard } from '@/components/events/event-card'
import { ApplyButton } from '@/components/events/apply-button'
import type { Event } from '@/types/database'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function EventsWithApplications({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [{ data: events }, { data: myApplications }, { data: passport }] = await Promise.all([
    supabase
      .from('events')
      .select(`
        *,
        category_limits:event_category_limits(
          *,
          category:categories(id, name)
        )
      `)
      .in('status', ['published', 'active'])
      .order('start_at', { ascending: true }),
    supabase
      .from('booth_applications')
      .select('event_id, status, category_id')
      .eq('vendor_id', userId),
    supabase
      .from('vendor_passports')
      .select('id, primary_category_id')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (!passport) {
    return (
      <div className="rounded-2xl border bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h3 className="font-semibold text-gray-900">Passport Required</h3>
        <p className="mt-1 text-sm text-gray-600">
          Create your vendor passport before applying to events.
        </p>
        <Link href="/vendor/passport">
          <Button className="mt-4 bg-amber-500 hover:bg-amber-600 text-white" size="sm">
            Create Passport
          </Button>
        </Link>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <p className="text-gray-500">No open events accepting vendors right now.</p>
      </div>
    )
  }

  const appliedEventIds = new Set((myApplications ?? []).map((a) => a.event_id))

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(events as Event[]).map((event) => {
        const alreadyApplied = appliedEventIds.has(event.id)
        return (
          <EventCard
            key={event.id}
            event={event}
            href={`/vendor/events/${event.id}`}
            actions={
              <ApplyButton
                event={event}
                passportId={passport.id}
                userId={userId}
                alreadyApplied={alreadyApplied}
              />
            }
          />
        )
      })}
    </div>
  )
}

export default async function VendorEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Browse Open Markets</h1>
        <p className="mt-1 text-gray-500">Find events accepting vendor applications</p>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
          </div>
        }
      >
        <EventsWithApplications userId={user.id} />
      </Suspense>
    </div>
  )
}
