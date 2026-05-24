'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, CreditCard } from 'lucide-react'
import { PayBoothModal } from '@/components/events/pay-booth-modal'
import {
  isApplicationPaid,
  needsEtransferCoordinatorReview,
  needsSquareCheckout,
} from '@/lib/applications/payment-fields'
import type { BoothApplication, EventCancellationReason, PaymentStatus } from '@/types/database'
import { CancellationDetails } from '@/components/vendor/cancellation-details'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'
import { MarketInsuranceUpload } from '@/components/vendor/market-insurance-upload'
import { marketStatusBadge } from '@/lib/theme/market'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pending Review', class: marketStatusBadge.warning },
  pending_insurance: { label: 'Pending Proof of Insurance', class: marketStatusBadge.warning },
  approved: { label: 'Approved', class: marketStatusBadge.success },
  rejected: { label: 'Declined', class: marketStatusBadge.error },
  waitlisted: { label: 'Waitlisted', class: marketStatusBadge.warning },
  cancelled: { label: 'Cancelled', class: marketStatusBadge.neutral },
}

interface VendorApplicationsListProps {
  applications: BoothApplication[]
  categoryPrices: Record<string, number>
  userId: string
}

export function VendorApplicationsList({
  applications,
  categoryPrices,
  userId,
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
        <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">No applications yet.</p>
        <Link href="/vendor/events">
          <Button size="sm" className="mt-4">
            Apply for open markets
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
          const needsPayment = needsSquareCheckout(app)
          const eTransferPending = needsEtransferCoordinatorReview(app)

          return (
            <div
              key={app.id}
              className={`rounded-xl border bg-white p-4 ${eventCancelled ? 'border-red-200' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground text-sm">
                    {app.event?.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {app.event?.start_at
                        ? format(new Date(app.event.start_at), 'MMM d, yyyy')
                        : ''}
                    </span>
                    {!eventCancelled && (
                      <Badge className={`text-[10px] ${config.class}`}>{config.label}</Badge>
                    )}
                    {needsPayment && (
                      <Badge className="text-[10px] bg-harvest-100 text-harvest-700">
                        Payment required
                      </Badge>
                    )}
                    {eTransferPending && (
                      <Badge className="text-[10px] bg-sky-100 text-sky-900">
                        E-transfer pending review
                      </Badge>
                    )}
                    {isApplicationPaid(app) && (
                      <Badge className="text-[10px] bg-sage-100 text-sage-800">
                        {app.payment_method === 'ETRANSFER' ? 'E-transfer confirmed' : 'Paid'}
                      </Badge>
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
                  {app.status === 'pending_insurance' && !eventCancelled ? (
                    <MarketInsuranceUpload
                      applicationId={app.id}
                      userId={userId}
                      eventName={ev?.name ?? 'this market'}
                      onComplete={() => router.refresh()}
                    />
                  ) : null}
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
                      className=" h-8 text-xs"
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
