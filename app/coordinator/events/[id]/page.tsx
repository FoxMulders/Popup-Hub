import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { EventStatusToggle } from '@/components/coordinator/event-status-toggle'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { MapPin, Calendar, Clock } from 'lucide-react'
import type { Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('*, category_limits:event_category_limits(*, category:categories(name))')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles(id, full_name, email, phone, avatar_url),
      passport:vendor_passports(business_name, bio, logo_url, item_image_urls, is_verified, tax_id_encrypted),
      category:categories(name)
    `)
    .eq('event_id', id)
    .order('applied_at', { ascending: true })

  const pendingCount = applications?.filter((a) => a.status === 'pending').length ?? 0
  const approvedCount = applications?.filter((a) => a.status === 'approved').length ?? 0
  const waitlistedCount = applications?.filter((a) => a.status === 'waitlisted').length ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-500" />{event.location_name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {format(new Date(event.start_at), 'h:mm a')} – {format(new Date(event.end_at), 'h:mm a')}
              </span>
            </div>
          </div>
          <EventStatusToggle event={event as Event} />
        </div>

        <Separator className="my-4" />

        {event.category_limits && event.category_limits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.category_limits.map((cl: { id: string; category?: { name: string }; max_slots: number; price_per_booth: number }) => (
              <Badge key={cl.id} variant="outline" className="text-xs">
                {cl.category?.name}: {cl.max_slots} slots
                {cl.price_per_booth > 0 ? ` · $${(cl.price_per_booth / 100).toFixed(2)}` : ' · Free'}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending Review', count: pendingCount, color: 'text-yellow-600' },
          { label: 'Approved', count: approvedCount, color: 'text-green-600' },
          { label: 'Waitlisted', count: waitlistedCount, color: 'text-blue-600' },
        ].map(({ label, count, color }) => (
          <div key={label} className="rounded-xl border bg-white p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Applications ({applications?.length ?? 0})
        </h2>
        <ApplicationBoard
          applications={(applications as never[]) ?? []}
          bookingMode={event.booking_mode}
        />
      </div>
    </div>
  )
}
