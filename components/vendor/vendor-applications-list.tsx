'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  CreditCard,
  ExternalLink,
  MapPin,
  MessageSquare,
} from 'lucide-react'
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
import { ApplicationFollowUpDialog } from '@/components/vendor/application-follow-up-dialog'
import { MarketOwnerLink, vendorApplicationStatusHref } from '@/components/vendor/market-owner-link'
import {
  filterVendorApplications,
  VENDOR_APPLICATION_STATUS_UI,
  type VendorApplicationFilter,
} from '@/lib/vendor/application-status-ui'

interface VendorApplicationsListProps {
  applications: BoothApplication[]
  categoryPrices: Record<string, number>
  userId: string
  initialFilter?: VendorApplicationFilter
  showFilters?: boolean
}

function canSendFollowUp(app: BoothApplication): boolean {
  const base = VENDOR_APPLICATION_STATUS_UI[app.status]?.canFollowUp ?? false
  if (base) return true
  if (app.status === 'approved') {
    return needsSquareCheckout(app) || needsEtransferCoordinatorReview(app)
  }
  return false
}

function followUpHint(app: BoothApplication): string {
  if (app.status === 'pending') {
    return 'Waiting on organizer review'
  }
  if (app.status === 'waitlisted') {
    return 'On waitlist — organizer notified if a spot opens'
  }
  if (app.status === 'pending_insurance') {
    return 'Upload insurance or message the organizer'
  }
  if (needsSquareCheckout(app)) {
    return 'Approved — payment still required'
  }
  if (needsEtransferCoordinatorReview(app)) {
    return 'Send e-transfer or confirm with organizer'
  }
  return VENDOR_APPLICATION_STATUS_UI[app.status]?.nextStep ?? ''
}

export function VendorApplicationsList({
  applications,
  categoryPrices,
  userId,
  initialFilter = 'all',
  showFilters = true,
}: VendorApplicationsListProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<VendorApplicationFilter>(initialFilter)
  const [payTarget, setPayTarget] = useState<{
    applicationId: string
    eventId: string
    eventName: string
    boothPriceCents: number
  } | null>(null)
  const [followUpTarget, setFollowUpTarget] = useState<BoothApplication | null>(null)

  const filteredApplications = useMemo(
    () => filterVendorApplications(applications, filter),
    [applications, filter],
  )

  const filterCounts = useMemo(
    () => ({
      all: applications.length,
      active: filterVendorApplications(applications, 'active').length,
      pending: filterVendorApplications(applications, 'pending').length,
      approved: filterVendorApplications(applications, 'approved').length,
      waitlisted: filterVendorApplications(applications, 'waitlisted').length,
      closed: filterVendorApplications(applications, 'closed').length,
    }),
    [applications],
  )

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-12 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">No applications yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          When you apply to a juried market, it will appear here with status and follow-up options.
        </p>
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
      {showFilters ? (
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as VendorApplicationFilter)}
          className="mb-4"
        >
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {(
              [
                ['all', 'All', filterCounts.all],
                ['active', 'Active', filterCounts.active],
                ['pending', 'Pending', filterCounts.pending],
                ['approved', 'Approved', filterCounts.approved],
                ['waitlisted', 'Waitlisted', filterCounts.waitlisted],
                ['closed', 'Closed', filterCounts.closed],
              ] as const
            ).map(([key, label, count]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-full border bg-white px-3 py-1.5 text-xs data-[state=active]:border-harvest-300 data-[state=active]:bg-harvest-50"
              >
                {label} ({count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {filteredApplications.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white py-10 text-center">
          <p className="text-sm text-muted-foreground">No applications in this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map((app) => {
            const statusUi = VENDOR_APPLICATION_STATUS_UI[app.status]
            const eventCancelled = app.event?.status === 'cancelled'
            const ev = app.event as {
              id?: string
              name?: string
              location_name?: string
              start_at?: string
              end_at?: string
              status?: string
              booking_mode?: string
              cancellation_reason?: EventCancellationReason | null
              cancellation_reason_notes?: string | null
              coordinator?: {
                id?: string
                full_name?: string | null
                email?: string | null
                avatar_url?: string | null
              } | {
                id?: string
                full_name?: string | null
                email?: string | null
                avatar_url?: string | null
              }[] | null
            } | undefined
            const coordinator = Array.isArray(ev?.coordinator) ? ev?.coordinator[0] : ev?.coordinator
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
            const showFollowUp = !eventCancelled && canSendFollowUp(app)

            const eventHref = ev?.id ? vendorApplicationStatusHref(ev.id) : '/vendor/applications'

            return (
              <article
                key={app.id}
                className={`rounded-xl border bg-white p-4 ${eventCancelled ? 'border-red-200' : ''}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={eventHref}
                          className="truncate font-semibold text-foreground text-sm hover:text-harvest-700 hover:underline"
                        >
                          {app.event?.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {app.event?.start_at ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(app.event.start_at), 'EEE, MMM d, yyyy')}
                            </span>
                          ) : null}
                          {ev?.location_name ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {ev.location_name}
                            </span>
                          ) : null}
                          {app.applied_at ? (
                            <span>
                              Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {coordinator?.id && coordinator.full_name ? (
                        <MarketOwnerLink
                          owner={{
                            id: coordinator.id,
                            full_name: coordinator.full_name,
                            avatar_url: coordinator.avatar_url,
                          }}
                          compact
                          className="shrink-0"
                        />
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!eventCancelled ? (
                        <Link href={eventHref} className="inline-flex">
                          <Badge className={`cursor-pointer text-[10px] transition-opacity hover:opacity-90 ${statusUi.badgeClass}`}>
                            {statusUi.label}
                          </Badge>
                        </Link>
                      ) : null}
                      {ev?.booking_mode === 'juried' ? (
                        <Badge variant="outline" className="text-[10px]">
                          Juried
                        </Badge>
                      ) : null}
                      {needsPayment ? (
                        <Badge className="text-[10px] bg-harvest-100 text-harvest-700">
                          Payment required
                        </Badge>
                      ) : null}
                      {eTransferPending ? (
                        <Badge className="text-[10px] bg-sky-100 text-sky-900">
                          E-transfer pending review
                        </Badge>
                      ) : null}
                      {isApplicationPaid(app) ? (
                        <Badge className="text-[10px] bg-sage-100 text-sage-800">
                          {app.payment_method === 'ETRANSFER' ? 'E-transfer confirmed' : 'Paid'}
                        </Badge>
                      ) : null}
                      {app.category ? (
                        <Badge variant="outline" className="text-[10px]">
                          {app.category.name}
                        </Badge>
                      ) : null}
                    </div>

                    {!eventCancelled ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {followUpHint(app)}
                      </p>
                    ) : null}

                    {eventCancelled ? (
                      <CancellationDetails
                        reasonLabel={cancellationReasonLabel}
                        paymentStatus={app.payment_status as PaymentStatus}
                        compact
                      />
                    ) : null}

                    {app.status === 'pending_insurance' && !eventCancelled ? (
                      <MarketInsuranceUpload
                        applicationId={app.id}
                        userId={userId}
                        eventName={ev?.name ?? 'this market'}
                        onComplete={() => router.refresh()}
                      />
                    ) : null}

                    {!eventCancelled ? (
                      <Link
                        href={eventHref}
                        className="inline-flex text-xs font-medium text-harvest-700 hover:underline"
                      >
                        View application status →
                      </Link>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[148px] sm:items-end">
                    {app.waitlist_position && !eventCancelled ? (
                      <span className="text-xs font-medium text-blue-600">
                        #{app.waitlist_position} in waitlist queue
                      </span>
                    ) : null}

                    {needsPayment && ev?.id ? (
                      <Button
                        size="sm"
                        className="h-9 text-xs"
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
                    ) : null}

                    {showFollowUp ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs"
                        onClick={() => setFollowUpTarget(app)}
                      >
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                        Follow up
                      </Button>
                    ) : null}

                    {ev?.id ? (
                      <Link
                        href={eventHref}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        View status
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {payTarget ? (
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
      ) : null}

      {followUpTarget ? (
        <ApplicationFollowUpDialog
          applicationId={followUpTarget.id}
          eventName={
            (Array.isArray(followUpTarget.event)
              ? followUpTarget.event[0]?.name
              : followUpTarget.event?.name) ?? 'this market'
          }
          coordinatorName={
            Array.isArray(followUpTarget.event)
              ? followUpTarget.event[0]?.coordinator?.full_name
              : (followUpTarget.event as { coordinator?: { full_name?: string | null } })?.coordinator
                  ?.full_name
          }
          coordinatorEmail={
            Array.isArray(followUpTarget.event)
              ? followUpTarget.event[0]?.coordinator?.email
              : (followUpTarget.event as { coordinator?: { email?: string | null } })?.coordinator
                  ?.email
          }
          open={!!followUpTarget}
          onOpenChange={(open) => !open && setFollowUpTarget(null)}
        />
      ) : null}
    </>
  )
}
