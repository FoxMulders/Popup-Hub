'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, CreditCard } from 'lucide-react'
import { PayBoothModal } from '@/components/events/pay-booth-modal'
import type { BoothApplication, EventCancellationReason, PaymentStatus } from '@/types/database'
import { CancellationDetails } from '@/components/vendor/cancellation-details'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pending Review', class: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', class: 'bg-green-100 text-green-700' },
  rejected: { label: 'Declined', class: 'bg-red-100 text-red-600' },
  waitlisted: { label: 'Waitlisted', class: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-500' },
}

interface VendorApplicationsListProps {
  applications: BoothApplication[]
  categoryPrices: Record<string, number>
}

export function VendorApplicationsList({
  applications,
  categoryPrices,
}: VendorApplicationsListProps) {
  const router = useRouter()
  const [payTarget, setPayTarget] = useState<{
    applicationId: string
    eventId: string
    eventName: string
    boothPriceCents: number
  } | null>(null)

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-12 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-gray-500 text-sm">No applications yet.</p>
        <Link href="/vendor/events">
          <Button size="sm" className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
            Browse Open Markets
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {applications.map((app) => {
          const config = STATUS_CONFIG[app.status]
          const eventCancelled = app.event?.status === 'cancelled'
          const ev = app.event as {
            id?: string
            name?: string
            start_at?: string
            status?: string
            cancellation_reason?: EventCancellationReason | null
            cancellation_reason_notes?: string | null
          } | undefined
          const cancellationReasonLabel =
            app.event_cancellation_reason_label ??
            (eventCancelled && ev?.cancellation_reason
              ? getCancellationReasonLabel(ev.cancellation_reason, ev.cancellation_reason_notes)
              : null)
          const boothPrice = app.category_id
            ? categoryPrices[`${app.event_id}:${app.category_id}`] ?? 0
            : 0
          const needsPayment = app.payment_status === 'payment_required'

          return (
            <div
              key={app.id}
              className={`rounded-xl border bg-white p-4 ${eventCancelled ? 'border-red-200' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 text-sm">
                    {app.event?.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {app.event?.start_at
                        ? format(new Date(app.event.start_at), 'MMM d, yyyy')
                        : ''}
                    </span>
                    {!eventCancelled && (
                      <Badge className={`text-[10px] ${config.class}`}>{config.label}</Badge>
                    )}
                    {needsPayment && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800">
                        Payment required
                      </Badge>
                    )}
                    {app.payment_status === 'paid' && (
                      <Badge className="text-[10px] bg-green-100 text-green-700">Paid</Badge>
                    )}
                    {app.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {app.category.name}
                      </Badge>
                    )}
                  </div>
                  {eventCancelled && (
                    <CancellationDetails
                      reasonLabel={cancellationReasonLabel}
                      paymentStatus={app.payment_status as PaymentStatus}
                      compact
                    />
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {app.waitlist_position && !eventCancelled && (
                    <span className="text-xs text-blue-600 font-medium">
                      #{app.waitlist_position} in queue
                    </span>
                  )}
                  {needsPayment && ev?.id && (
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs"
                      onClick={() =>
                        setPayTarget({
                          applicationId: app.id,
                          eventId: ev.id!,
                          eventName: ev.name ?? 'Event',
                          boothPriceCents: boothPrice,
                        })
                      }
                    >
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                      Pay Now
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {payTarget && (
        <PayBoothModal
          open={!!payTarget}
          onOpenChange={(open) => !open && setPayTarget(null)}
          applicationId={payTarget.applicationId}
          eventId={payTarget.eventId}
          eventName={payTarget.eventName}
          boothPriceCents={payTarget.boothPriceCents}
          onSuccess={() => {
            setPayTarget(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
