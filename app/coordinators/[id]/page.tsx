import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { VendorAccessRequestForm } from '@/components/shopper/vendor-access-request-form'
import { getVendorAccessRequest } from '@/lib/vendor/access'
import { format } from 'date-fns'
import { Calendar, MapPin, ArrowLeft } from 'lucide-react'
import type { Event, Role } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorPublicProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, full_name, avatar_url, role, created_at,
      reliability_score,
      coordinator_cancellation_count,
      coordinator_late_cancellation_count,
      recent_late_cancellation_at
    `)
    .eq('id', id)
    .eq('role', 'coordinator')
    .single()

  if (!profile) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let viewerRole: Role | null = null
  if (user) {
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    viewerRole = (viewerProfile?.role as Role | undefined) ?? 'shopper'
  }

  const existingRequest =
    user != null && viewerRole === 'vendor'
      ? await getVendorAccessRequest(supabase, user.id, id)
      : null

  const { data: events } = await supabase
    .from('events')
    .select('id, name, location_name, start_at, status')
    .eq('coordinator_id', id)
    .in('status', ['published', 'active', 'completed'])
    .order('start_at', { ascending: false })
    .limit(12)

  const initials = profile.full_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-amber-100 text-amber-800 text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{profile.full_name}</h1>
            <p className="text-sm text-gray-500">Market Organizer</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Member since {format(new Date(profile.created_at), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        <CoordinatorReliabilityBadge
          score={profile.reliability_score as number}
          recentLateCancellationAt={profile.recent_late_cancellation_at as string | null}
        />

        <div className="grid grid-cols-2 gap-3 pt-2 text-center text-sm">
          <div className="rounded-xl border bg-gray-50 p-3">
            <p className="text-xl font-bold text-gray-900">
              {(events ?? []).length}
            </p>
            <p className="text-xs text-gray-500">Active & past markets</p>
          </div>
          <div className="rounded-xl border bg-gray-50 p-3">
            <p className="text-xl font-bold text-gray-900">
              {profile.coordinator_cancellation_count as number}
            </p>
            <p className="text-xs text-gray-500">Total cancellations</p>
          </div>
        </div>

        {(profile.coordinator_late_cancellation_count as number) > 0 && (
          <p className="text-xs text-gray-500">
            {profile.coordinator_late_cancellation_count as number} cancellation
            {(profile.coordinator_late_cancellation_count as number) === 1 ? '' : 's'} occurred
            with less than 7 days notice (non-emergency).
          </p>
        )}
      </div>

      {viewerRole === 'vendor' ? (
        <VendorAccessRequestForm
          coordinatorId={profile.id}
          coordinatorName={profile.full_name}
          userId={user?.id ?? null}
          existingRequest={existingRequest}
        />
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Markets</h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-gray-400">No public markets listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {(events as Pick<Event, 'id' | 'name' | 'location_name' | 'start_at' | 'status'>[]).map(
              (ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 hover:bg-amber-50/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{ev.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {ev.location_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ev.start_at), 'MMM d, yyyy')}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                        {ev.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
