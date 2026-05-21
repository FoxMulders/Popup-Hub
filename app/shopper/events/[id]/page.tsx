import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { VendorRosterCard } from '@/components/events/vendor-roster-card'
import { format } from 'date-fns'
import { MapPin, Calendar, Clock, Users, Ticket } from 'lucide-react'
import type { BoothApplication } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

async function VendorRoster({ eventId }: { eventId: string }) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles(id, full_name, avatar_url),
      passport:vendor_passports(business_name, bio, logo_url, item_image_urls, is_verified),
      category:categories(name)
    `)
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('approved_at', { ascending: true })

  if (!applications || applications.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-12 text-center">
        <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-gray-500 text-sm">Vendor lineup coming soon.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {applications.map((app) => (
        <VendorRosterCard key={app.id} application={app as BoothApplication} />
      ))}
    </div>
  )
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      coordinator:profiles(full_name, avatar_url),
      category_limits:event_category_limits(*, category:categories(name))
    `)
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .single()

  if (!event) notFound()

  const { count: vendorCount } = await supabase
    .from('booth_applications')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('status', 'approved')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.name} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
            <MapPin className="h-16 w-16 text-amber-300" />
          </div>
        )}
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              {event.description && <p className="mt-2 text-gray-600 max-w-2xl">{event.description}</p>}
            </div>
            <Badge className={`capitalize text-sm ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {event.status}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="truncate">{event.location_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
              {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              {format(new Date(event.start_at), 'h:mm a')} – {format(new Date(event.end_at), 'h:mm a')}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4 text-amber-500 flex-shrink-0" />
              {vendorCount ?? 0} vendor{vendorCount !== 1 ? 's' : ''} confirmed
            </div>
          </div>
          {event.category_limits && event.category_limits.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {event.category_limits.map((cl: { id: string; category?: { name: string } }) => (
                <Badge key={cl.id} variant="outline" className="text-xs">{cl.category?.name}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Confirmed Vendors</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Ticket className="h-4 w-4" />
            <span>{vendorCount ?? 0} confirmed</span>
          </div>
        </div>
        <Suspense fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        }>
          <VendorRoster eventId={id} />
        </Suspense>
      </div>
    </div>
  )
}
