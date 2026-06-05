import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { fetchCoordinatorEventApplications } from '@/lib/applications/fetch-coordinator-applications'
import { buildCategoryNameMap } from '@/lib/applications/display-categories'
import { isEventArchived } from '@/lib/queries/events'
import type { BoothApplication, Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ApplicationsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: allCategories }] = await Promise.all([
    supabase
      .from('events')
      .select('*, category_limits:event_category_limits(*, category:categories(name))')
      .eq('id', id)
      .eq('coordinator_id', user.id)
      .single(),
    supabase.from('categories').select('id, name'),
  ])

  if (!event) notFound()

  const {
    applications,
    error: applicationsError,
    usedFallback,
  } = await fetchCoordinatorEventApplications(supabase, id)

  const categoryNameById = buildCategoryNameMap(allCategories ?? [])
  const eventCancelled = event.status === 'cancelled'
  const marketEnded = isEventArchived(event as Event)

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 xl:px-10">
      <div className="mb-8 space-y-2">
        <Link href={`/coordinator/events/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-semibold text-foreground">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location_name}
              </div>
              <Badge variant="outline" className="capitalize">
                {event.booking_mode === 'instant' ? '⚡ Instant Book' : '🔍 Juried'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {applicationsError ? (
        <div
          className="rounded-xl border border-terracotta-200 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-900"
          role="alert"
        >
          Could not load full vendor details: {applicationsError}. Applications are shown with limited
          profile data.
        </div>
      ) : null}
      {usedFallback && !applicationsError ? (
        <div
          className="mb-4 rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3 text-sm text-harvest-900"
          role="status"
        >
          Loaded applications without passport details. You can still review and approve vendors.
        </div>
      ) : null}
      {!applicationsError || applications.length > 0 ? (
        <ApplicationBoard
          applications={applications}
          bookingMode={(event as Event).booking_mode}
          categoryNameById={Object.fromEntries(categoryNameById)}
          categoryLimits={(event.category_limits ?? []) as Event['category_limits']}
          marketInsuranceRequired={Boolean((event as Event).market_insurance_required)}
          eventCancelled={eventCancelled}
          marketEnded={marketEnded}
        />
      ) : (
        <div className="rounded-xl border border-stone-200 bg-canvas px-4 py-8 text-center text-sm text-muted-foreground">
          No applications for this market yet.
        </div>
      )}
    </div>
  )
}
