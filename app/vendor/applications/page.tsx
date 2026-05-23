import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { Suspense } from 'react'
import { Calendar, MapPin } from 'lucide-react'
import { QRButton } from '@/components/vendor/qr-button'
import { CancellationDetails } from '@/components/vendor/cancellation-details'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'
import type { BoothApplication, EventCancellationReason, PaymentStatus } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', class: 'bg-green-100 text-green-700' },
  rejected: { label: 'Declined', class: 'bg-red-100 text-red-600' },
  waitlisted: { label: 'Waitlisted', class: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-500' },
}

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

  if (!applications || applications.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-16 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-200" />
        <p className="text-sm text-gray-400">No applications yet. Browse events to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(applications as BoothApplication[]).map((app) => {
        const config = STATUS_CONFIG[app.status]
        const event = app.event as {
          id: string
          name: string
          location_name: string
          start_at: string
          cover_image_url: string | null
          status?: string
          cancellation_reason?: EventCancellationReason | null
          cancellation_reason_notes?: string | null
        }
        const eventCancelled = event?.status === 'cancelled'
        const cancellationReasonLabel =
          app.event_cancellation_reason_label ??
          (eventCancelled && event?.cancellation_reason
            ? getCancellationReasonLabel(
                event.cancellation_reason,
                event.cancellation_reason_notes
              )
            : null)

        return (
          <div
            key={app.id}
            className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border bg-white p-4 shadow-sm ${
              eventCancelled ? 'border-red-200' : ''
            }`}
          >
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-amber-50">
              {event?.cover_image_url ? (
                <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-6 w-6 text-amber-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900">{event?.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">
                  {event?.start_at ? format(new Date(event.start_at), 'MMM d, yyyy') : ''}
                </span>
                {app.category && (
                  <Badge variant="outline" className="text-[10px]">{app.category.name}</Badge>
                )}
                {!eventCancelled && (
                  <Badge className={`text-[10px] ${config.class}`}>{config.label}</Badge>
                )}
              </div>
              {eventCancelled && (
                <CancellationDetails
                  reasonLabel={cancellationReasonLabel}
                  paymentStatus={app.payment_status as PaymentStatus}
                />
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 sm:ml-auto">
              {app.waitlist_position && (
                <span className="text-xs font-medium text-blue-600">
                  Queue #{app.waitlist_position}
                </span>
              )}
              {app.booth_number && (
                <span className="text-xs font-medium text-green-600">
                  Booth #{app.booth_number}
                </span>
              )}
              {app.status === 'approved' && event?.id && !eventCancelled && (
                <QRButton
                  eventId={event.id}
                  applicationId={app.id}
                  eventName={event.name}
                  boothNumber={app.booth_number}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function VendorApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Applications</h1>
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
