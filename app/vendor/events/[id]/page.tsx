import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApplyButton } from '@/components/events/apply-button'
import { MarketFeedbackWidget } from '@/components/coordinator/market-feedback-widget'
import { hasCoordinatorApproval } from '@/lib/vendor/access'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { formatCents } from '@/lib/square/client'
import { format } from 'date-fns'
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react'
import type { Event, EventCategoryLimit } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VendorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: passport }, { data: existingApp }] = await Promise.all([
    supabase
      .from('events')
      .select(`
        *,
        coordinator:profiles(
          id, full_name, avatar_url,
          reliability_score, recent_late_cancellation_at
        ),
        category_limits:event_category_limits(*, category:categories(id, name, is_mlm))
      `)
      .eq('id', id)
      .in('status', ['published', 'active'])
      .single(),
    supabase.from('vendor_passports').select('id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('booth_applications')
      .select('id, status')
      .eq('event_id', id)
      .eq('vendor_id', user.id)
      .maybeSingle(),
  ])

  if (!event) notFound()

  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const approved = await hasCoordinatorApproval(supabase, user.id, event.coordinator_id)

  const sortedLimits = [...(event.category_limits ?? [])].sort(
    (a: EventCategoryLimit, b: EventCategoryLimit) =>
      (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/vendor/events">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to markets
        </Button>
      </Link>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.name} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-32 items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
            <MapPin className="h-12 w-12 text-amber-300" />
          </div>
        )}
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <Badge className="capitalize">{event.booking_mode === 'juried' ? 'Juried review' : 'Instant book'}</Badge>
          </div>
          {event.description ? <p className="text-sm text-gray-600">{event.description}</p> : null}
          <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{event.location_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'h:mm a')} – {format(new Date(event.end_at), 'h:mm a')}
            </div>
          </div>
          {coordinator ? (
            <div className="rounded-xl border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Organizer</p>
              <Link
                href={`/coordinators/${coordinator.id}`}
                className="text-sm font-medium text-amber-800 hover:underline"
              >
                {coordinator.full_name}
              </Link>
              <div className="mt-2">
                <CoordinatorReliabilityBadge
                  score={coordinator.reliability_score ?? 100}
                  recentLateCancellationAt={coordinator.recent_late_cancellation_at}
                  size="sm"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {sortedLimits.length > 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Booth categories</h2>
          <ul className="space-y-2">
            {sortedLimits.map((cl: EventCategoryLimit) => (
              <li
                key={cl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{cl.category?.name}</span>
                <span className="text-gray-500">
                  {cl.max_slots} slots · {cl.price_per_booth > 0 ? formatCents(cl.price_per_booth) : 'Free'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-6">
        {!passport ? (
          <div className="text-center">
            <p className="text-sm text-gray-600">Create your vendor passport before applying.</p>
            <Link href="/vendor/passport">
              <Button className="mt-3" size="sm">
                Create passport
              </Button>
            </Link>
          </div>
        ) : (
          <ApplyButton
            event={event as Event}
            passportId={passport.id}
            userId={user.id}
            alreadyApplied={existingApp != null}
            hasCoordinatorApproval={approved}
            coordinatorId={event.coordinator_id}
            coordinatorName={coordinator?.full_name ?? 'Organizer'}
          />
        )}
        {existingApp ? (
          <p className="mt-3 text-center text-xs text-gray-500 capitalize">
            Application status: {existingApp.status}
          </p>
        ) : null}
      </div>

      <MarketFeedbackWidget marketId={id} />
    </div>
  )
}
