'use client'

import { useState, useTransition, useEffect } from 'react'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Users, Eye, AlertTriangle, FileText, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { marketStatusBadge } from '@/lib/theme/market'
import { formatAttendanceDayLabels } from '@/lib/events/event-schedule-days'
import { formatCategoryOverflowLabel } from '@/lib/vendor/application-category-match'
import { resolveApplicationDisplayCategories } from '@/lib/applications/display-categories'
import {
  ETRANSFER_PAYMENT_GATE_MESSAGE,
  isApplicationPaid,
  isEtransferAwaitingPayment,
  needsEtransferCoordinatorReview,
  needsSquareCheckout,
} from '@/lib/applications/payment-fields'
import { VendorReviewDrawer } from '@/components/coordinator/vendor-review-drawer'
import { VendorRecruitmentCallout } from '@/components/coordinator/vendor-recruitment-callout'
import type { BoothApplication, ApplicationStatus, EventCategoryLimit } from '@/types/database'

interface ApplicationBoardProps {
  applications: BoothApplication[]
  bookingMode: 'instant' | 'juried'
  eventId?: string
  eventName?: string
  eventStatus?: string
  eventCancelled?: boolean
  /** Market day has passed or status is completed — still allow resolving pending apps. */
  marketEnded?: boolean
  categoryNameById?: Record<string, string>
  categoryLimits?: EventCategoryLimit[]
  marketInsuranceRequired?: boolean
}

function ApplicationCategoryBadges({
  app,
  categoryNameById,
  compact,
}: {
  app: BoothApplication
  categoryNameById: Record<string, string>
  compact?: boolean
}) {
  const displayCategories = resolveApplicationDisplayCategories(app, categoryNameById)

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'mt-0.5' : 'mt-1'}`}>
      {displayCategories.map((name) => (
        <Badge key={`${app.id}-${name}`} variant="outline" className={compact ? 'text-[9px]' : 'text-xs'}>
          {name}
        </Badge>
      ))}
    </div>
  )
}

function CategoryOverflowBadge({ app }: { app: BoothApplication }) {
  if (!app.has_category_overflow) return null

  const label = formatCategoryOverflowLabel(app.overflow_category_names ?? [])

  return (
    <Badge className="w-full justify-center gap-1 border border-violet-400 bg-violet-100 text-violet-950 text-[10px] font-semibold py-1">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {label || 'Multi-Category Exception'}
    </Badge>
  )
}

const BOARD_COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending Review', color: 'text-harvest-800 bg-harvest-50 border-harvest-200' },
  { status: 'pending_insurance', label: 'Pending Insurance', color: 'text-harvest-800 bg-harvest-100 border-harvest-300' },
  { status: 'approved', label: 'Approved', color: 'text-sage-800 bg-sage-50 border-sage-200' },
  { status: 'waitlisted', label: 'Waitlisted', color: 'text-muted-foreground bg-canvas border-stone-200' },
  { status: 'rejected', label: 'Declined', color: 'text-terracotta-800 bg-terracotta-50 border-terracotta-200' },
]

/** Map a column's display status to the status sent to the API on drop. */
function columnDropStatus(columnStatus: ApplicationStatus): ApplicationStatus {
  if (columnStatus === 'pending_insurance') return 'approved'
  return columnStatus
}

export function ApplicationBoard({
  applications,
  bookingMode,
  eventId,
  eventName,
  eventStatus,
  eventCancelled,
  marketEnded = false,
  categoryNameById,
  categoryLimits = [],
  marketInsuranceRequired = false,
}: ApplicationBoardProps) {
  const [apps, setApps] = useState<BoothApplication[]>(applications)
  const categoryLookup = categoryNameById ?? {}
  const [viewingApp, setViewingApp] = useState<BoothApplication | null>(null)
  const [isPending, startTransition] = useTransition()
  const [verifyingVendorId, setVerifyingVendorId] = useState<string | null>(null)
  const [draggingAppId, setDraggingAppId] = useState<string | null>(null)
  const [dropTargetStatus, setDropTargetStatus] = useState<ApplicationStatus | null>(null)
  const [declineDropApp, setDeclineDropApp] = useState<BoothApplication | null>(null)
  const [declineDropMessage, setDeclineDropMessage] = useState('')

  useEffect(() => {
    setApps(applications)
  }, [applications])

  function markVendorVerified(vendorId: string) {
    const patch = (a: BoothApplication) =>
      a.vendor_id === vendorId && a.passport
        ? { ...a, passport: { ...a.passport, is_verified: true } }
        : a

    setApps((prev) => prev.map(patch))
    setViewingApp((prev) => (prev ? patch(prev) : null))
  }

  async function verifyVendor(vendorId: string, eventId: string) {
    const previousApps = apps
    const previousViewing = viewingApp

    markVendorVerified(vendorId)
    setVerifyingVendorId(vendorId)

    try {
      const res = await fetch('/api/coordinator/verify-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, eventId }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setApps(previousApps)
        setViewingApp(previousViewing)
        toast.error(data.error ?? 'Failed to verify vendor passport')
        return
      }

      toast.success('Vendor passport verified')
    } catch {
      setApps(previousApps)
      setViewingApp(previousViewing)
      toast.error('Failed to verify vendor passport')
    } finally {
      setVerifyingVendorId(null)
    }
  }

  const grouped = BOARD_COLUMNS.reduce<Record<ApplicationStatus, BoothApplication[]>>(
    (acc, col) => {
      acc[col.status] = apps.filter((a) => a.status === col.status)
      return acc
    },
    { pending: [], pending_insurance: [], approved: [], waitlisted: [], rejected: [], cancelled: [] }
  )

  function handleColumnDrop(appId: string, columnStatus: ApplicationStatus) {
    const app = apps.find((a) => a.id === appId)
    if (!app || app.status === columnStatus) return

    if (columnStatus === 'rejected') {
      setDeclineDropApp(app)
      setDeclineDropMessage('')
      return
    }

    void updateStatus(appId, columnDropStatus(columnStatus))
  }

  async function confirmEtransferPayment(appId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/coordinator/confirm-etransfer/${appId}`, { method: 'POST' })
      const data = (await res.json()) as {
        error?: string
        advancedToApproved?: boolean
        status?: ApplicationStatus
        updates?: Partial<BoothApplication>
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to confirm e-transfer payment')
        return
      }

      const updates = data.updates ?? {
        application_payment_status: 'COMPLETED' as const,
        payment_status: 'paid' as const,
        ...(data.status ? { status: data.status } : {}),
      }

      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, ...updates } : a)))
      setViewingApp((prev) => (prev?.id === appId ? { ...prev, ...updates } : prev))

      if (data.advancedToApproved) {
        toast.success(
          data.status === 'pending_insurance'
            ? 'Payment cleared — vendor moved to Pending Insurance'
            : '✅ Payment cleared & vendor approved — vendor notified'
        )
      } else {
        toast.success('E-transfer marked as received')
      }
    })
  }

  async function updateStatus(
    appId: string,
    newStatus: ApplicationStatus,
    declineMessage?: string,
  ) {
    startTransition(async () => {
      const app = apps.find((a) => a.id === appId)
      if (!app) return

      const res = await fetch(`/api/coordinator/applications/${appId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(declineMessage ? { declineMessage } : {}),
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        updates?: Partial<BoothApplication>
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update application status')
        return
      }

      const updates = data.updates ?? { status: newStatus }

      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, ...updates } : a))
      )

      if (updates.application_payment_status === 'PENDING_REVIEW') {
        void fetch(`/api/coordinator/etransfer-instructions/${appId}`, { method: 'POST' })
      }

      // Send in-app + SMS notification to vendor
      if (app.vendor_id && (newStatus === 'approved' || newStatus === 'rejected' || newStatus === 'waitlisted')) {
        const resolvedStatus = (updates.status ?? newStatus) as ApplicationStatus
        const notifMessages: Partial<Record<ApplicationStatus, string>> = {
          approved:
            updates.payment_status === 'payment_required'
              ? '✅ Your booth application has been approved! Complete your payment to secure your spot.'
              : updates.application_payment_status === 'PENDING_REVIEW'
                ? '✅ Your booth application has been approved! Send your e-transfer — the coordinator will confirm payment.'
                : '✅ Your booth application has been approved! See you at the event.',
          pending_insurance:
            '✅ Your booth application has been approved! Upload your market insurance proof to finalize your spot.',
          rejected: declineMessage
            ? declineMessage
            : `Your booth application was not selected this time. Keep an eye out for future events!`,
          waitlisted: `Your application has been waitlisted. We'll notify you if a spot opens up.`,
        }
        const message = notifMessages[resolvedStatus]
        if (message) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: app.vendor_id,
              type:
                resolvedStatus === 'approved' || resolvedStatus === 'pending_insurance'
                  ? 'application_approved'
                  : resolvedStatus === 'rejected'
                    ? 'application_rejected'
                    : 'waitlist_triggered',
              message,
              metadata: {
                application_id: appId,
                event_id: app.event_id,
                payment_required: updates.payment_status === 'payment_required',
              },
              send_sms: true,
            }),
          })
        }
      }

      const resolvedLabel = (updates.status ?? newStatus) as ApplicationStatus
      const labels: Record<ApplicationStatus, string> = {
        approved: '✅ Application approved — vendor notified',
        pending_insurance: '✅ Approved — vendor must upload insurance proof',
        rejected: 'Application declined — vendor notified',
        waitlisted: 'Moved to waitlist — vendor notified',
        pending: 'Moved back to pending',
        cancelled: 'Application cancelled',
      }
      toast.success(labels[resolvedLabel])
      setViewingApp((prev) => (prev?.id === appId ? null : prev))
    })
  }

  const totalApps = apps.length
  const approvedCount = grouped.approved.length
  const pendingCount = grouped.pending.length

  return (
    <div className="space-y-6">
      {eventCancelled && (
        <div className="rounded-xl border-2 border-terracotta-200 bg-terracotta-50 px-4 py-3 text-center">
          <p className="text-sm font-heading font-bold uppercase tracking-wide text-terracotta-800">
            Event Canceled — Refunds Processed
          </p>
          <p className="mt-1 text-xs text-terracotta-700">
            This market is closed. Vendor applications are read-only.
          </p>
        </div>
      )}

      {!eventCancelled && marketEnded && pendingCount > 0 && (
        <div className="rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3 text-center">
          <p className="text-sm font-heading font-semibold text-harvest-900">
            This market has ended — resolve {pendingCount} pending application
            {pendingCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-harvest-800/90">
            New vendor applications are closed, but you can still approve, waitlist, or decline
            submissions received before the event.
          </p>
        </div>
      )}

      {/* Summary bar */}
      <dl className="flex flex-wrap gap-4 p-4 market-panel rounded-xl">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Total applications</dt>
          <dd className="font-medium text-foreground">{totalApps} total applications</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-sage-600" aria-hidden />
          <dt className="sr-only">Approved</dt>
          <dd className="font-medium text-sage-800">{approvedCount} approved</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-harvest-500" aria-hidden />
          <dt className="sr-only">Pending</dt>
          <dd className="font-medium text-harvest-800">{pendingCount} awaiting review</dd>
        </div>
        {bookingMode === 'instant' && (
          <Badge className={`${marketStatusBadge.warning} text-xs`}>
            ⚡ Instant booking — applications auto-approve
          </Badge>
        )}
      </dl>

      {totalApps === 0 && !eventCancelled && eventId ? (
        <VendorRecruitmentCallout
          eventId={eventId}
          eventName={eventName}
          eventStatus={eventStatus}
        />
      ) : null}

      {!eventCancelled ? (
        <p className="text-xs text-muted-foreground">
          Drag cards between columns to change status. Open a card to review details or use quick actions on pending applications.
        </p>
      ) : null}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-5">
        {BOARD_COLUMNS.map((col) => {
          const colApps = grouped[col.status]
          const isDropTarget = dropTargetStatus === col.status
          return (
            <div key={col.status} className="space-y-3">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${col.color}`}>
                <span className="text-xs font-bold uppercase tracking-wide">{col.label}</span>
                <span className="text-xs font-bold">{colApps.length}</span>
              </div>

              <div
                className={cn(
                  'min-h-[8rem] space-y-2 rounded-xl p-1 transition-colors',
                  isDropTarget && 'bg-sage-50 ring-2 ring-sage-300 ring-offset-2',
                )}
                onDragOver={(event) => {
                  if (eventCancelled || !draggingAppId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropTargetStatus(col.status)
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return
                  setDropTargetStatus((prev) => (prev === col.status ? null : prev))
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDropTargetStatus(null)
                  const appId = event.dataTransfer.getData('application/id') || draggingAppId
                  setDraggingAppId(null)
                  if (!appId || eventCancelled) return
                  handleColumnDrop(appId, col.status)
                }}
              >
                {colApps.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-stone-200 py-8 text-center bg-canvas/50">
                    <p className="text-xs text-muted-foreground">None here</p>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      categoryNameById={categoryLookup}
                      eventCancelled={eventCancelled}
                      isDragging={draggingAppId === app.id}
                      onOpenReview={() => setViewingApp(app)}
                      onApprove={() => updateStatus(app.id, 'approved')}
                      onReject={() => updateStatus(app.id, 'rejected')}
                      onWaitlist={() => updateStatus(app.id, 'waitlisted')}
                      onConfirmEtransfer={() => confirmEtransferPayment(app.id)}
                      onDragStart={() => setDraggingAppId(app.id)}
                      onDragEnd={() => {
                        setDraggingAppId(null)
                        setDropTargetStatus(null)
                      }}
                      loading={isPending}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={!!declineDropApp}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineDropApp(null)
            setDeclineDropMessage('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline application</DialogTitle>
            <DialogDescription>
              Optional message for{' '}
              {declineDropApp?.passport?.business_name ??
                declineDropApp?.vendor?.full_name ??
                'this vendor'}
              . They will receive it in their notification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineDropMessage}
            onChange={(event) => setDeclineDropMessage(event.target.value)}
            placeholder="Thank you for applying. We had limited spots in your category this round…"
            rows={4}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeclineDropApp(null)
                setDeclineDropMessage('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!declineDropApp) return
                void updateStatus(
                  declineDropApp.id,
                  'rejected',
                  declineDropMessage.trim() || undefined,
                )
                setDeclineDropApp(null)
                setDeclineDropMessage('')
              }}
            >
              Decline application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VendorReviewDrawer
        app={viewingApp}
        open={!!viewingApp}
        onOpenChange={(open) => !open && setViewingApp(null)}
        applications={apps}
        categoryNameById={categoryLookup}
        categoryLimits={categoryLimits}
        marketInsuranceRequired={marketInsuranceRequired}
        eventCancelled={eventCancelled}
        loading={isPending}
        verifying={viewingApp ? verifyingVendorId === viewingApp.vendor_id : false}
        onVerify={() => viewingApp && verifyVendor(viewingApp.vendor_id, viewingApp.event_id)}
        onConfirmEtransfer={() => viewingApp && confirmEtransferPayment(viewingApp.id)}
        onApprove={() => viewingApp && updateStatus(viewingApp.id, 'approved')}
        onWaitlist={() => viewingApp && updateStatus(viewingApp.id, 'waitlisted')}
        onDecline={(message) => viewingApp && updateStatus(viewingApp.id, 'rejected', message)}
      />
    </div>
  )
}

function ApplicationCard({
  app,
  categoryNameById,
  eventCancelled,
  isDragging,
  onOpenReview,
  onApprove,
  onReject,
  onWaitlist,
  onConfirmEtransfer,
  onDragStart,
  onDragEnd,
  loading,
}: {
  app: BoothApplication
  categoryNameById: Record<string, string>
  eventCancelled?: boolean
  isDragging?: boolean
  onOpenReview: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onConfirmEtransfer: () => void
  onDragStart: () => void
  onDragEnd: () => void
  loading: boolean
}) {
  const passport = app.passport
  const vendor = app.vendor
  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const showPendingActions = !eventCancelled && app.status === 'pending'
  const showWaitlistRecoveryActions =
    !eventCancelled && app.status === 'waitlisted'
  const showViewOnlyOnCard =
    app.status === 'approved' ||
    app.status === 'pending_insurance' ||
    app.status === 'rejected'

  return (
    <Card
      className={cn(
        'overflow-hidden transition-shadow hover:shadow-sm cursor-pointer',
        isDragging && 'opacity-50 ring-2 ring-sage-400',
      )}
      onClick={onOpenReview}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenReview()
        }
      }}
    >
      {passport?.item_image_urls?.[0] && (
        <div className="h-20 overflow-hidden">
          <img
            src={passport.item_image_urls[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          {!eventCancelled ? (
            <button
              type="button"
              draggable
              className="shrink-0 rounded p-0.5 text-stone-400 hover:text-stone-600 cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
              aria-label={`Drag ${displayName} to another column`}
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => {
                event.stopPropagation()
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('application/id', app.id)
                onDragStart()
              }}
              onDragEnd={(event) => {
                event.stopPropagation()
                onDragEnd()
              }}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <VendorLogo
            src={passport?.logo_url ?? vendor?.avatar_url}
            alt={`${displayName} logo`}
            fallback={initials}
            size="xs"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <ApplicationCategoryBadges app={app} categoryNameById={categoryNameById} compact />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
        </p>
        {app.attending_dates?.length ? (
          <p className="text-[10px] text-muted-foreground">
            Days: {formatAttendanceDayLabels(app.attending_dates).join(', ')}
          </p>
        ) : null}

        {needsSquareCheckout(app) && (
          <Badge className="w-full justify-center bg-harvest-100 text-harvest-700 text-[10px] py-1">
            Awaiting Square payment
          </Badge>
        )}

        {app.payment_method === 'ETRANSFER' &&
          app.application_payment_status === 'PENDING_REVIEW' &&
          app.status !== 'approved' &&
          app.status !== 'pending_insurance' && (
            <Badge className="w-full justify-center bg-sky-100 text-sky-900 text-[10px] py-1">
              Awaiting funds verification
            </Badge>
          )}

        {needsEtransferCoordinatorReview(app) && (
          <Badge className="w-full justify-center bg-sky-100 text-sky-900 text-[10px] py-1">
            E-transfer pending review
          </Badge>
        )}

        {app.status === 'approved' && isApplicationPaid(app) && (
          <Badge className="w-full justify-center bg-sage-100 text-sage-800 text-[10px] py-1">
            {app.payment_method === 'ETRANSFER' ? 'E-transfer confirmed' : 'Paid'}
          </Badge>
        )}

        {app.application_payment_status === 'EXPIRED' && (
          <Badge className="w-full justify-center bg-stone-200 text-stone-700 text-[10px] py-1">
            Payment expired
          </Badge>
        )}

        {eventCancelled && (
          <Badge className="w-full justify-center bg-terracotta-600 text-primary-foreground text-[10px] font-bold uppercase tracking-wide py-1 min-h-11">
            Event Canceled — Refund Processed
          </Badge>
        )}

        <CategoryOverflowBadge app={app} />

        {!eventCancelled &&
          app.status !== 'approved' &&
          app.status !== 'pending_insurance' &&
          app.status !== 'rejected' &&
          isEtransferAwaitingPayment(app) && (
            <p
              className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] leading-snug text-sky-900"
              role="note"
            >
              <span className="font-semibold">Approval blocked.</span>{' '}
              {ETRANSFER_PAYMENT_GATE_MESSAGE}
            </p>
          )}

        {app.applicable_documentation_url ? (
          <Badge className="w-full justify-center gap-1 bg-canvas text-[10px] text-foreground border-stone-200 py-1">
            <FileText className="h-3 w-3 shrink-0" aria-hidden />
            Permits on file
          </Badge>
        ) : null}

        <div className="flex gap-2 flex-wrap" onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 text-xs px-3 gap-1.5"
            onClick={onOpenReview}
          >
            <Eye className="h-4 w-4" />
            {showViewOnlyOnCard ? 'View' : 'Review'}
          </Button>
          {!eventCancelled &&
            app.payment_method === 'ETRANSFER' &&
            app.application_payment_status === 'PENDING_REVIEW' &&
            app.status !== 'rejected' && (
              <Button
                size="sm"
                className="min-h-11 text-xs px-3 gap-1.5 bg-sky-700 hover:bg-sky-800"
                onClick={onConfirmEtransfer}
                disabled={loading}
              >
                {app.status === 'approved' || app.status === 'pending_insurance'
                  ? 'Confirm e-transfer'
                  : 'Mark as Paid & Approve'}
              </Button>
            )}
          {showPendingActions &&
            !(
              app.payment_method === 'ETRANSFER' &&
              app.application_payment_status === 'PENDING_REVIEW'
            ) && (
              <Button
                size="sm"
                className="min-h-11 text-xs px-3 gap-1.5"
                onClick={onApprove}
                disabled={loading || isEtransferAwaitingPayment(app)}
                title={
                  isEtransferAwaitingPayment(app)
                    ? ETRANSFER_PAYMENT_GATE_MESSAGE
                    : undefined
                }
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
            )}
          {showPendingActions && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 text-xs px-3 gap-1.5 text-harvest-800 border-harvest-300"
              onClick={onWaitlist}
              disabled={loading}
            >
              Waitlist
            </Button>
          )}
          {(showPendingActions || showWaitlistRecoveryActions) && (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-xs px-3 gap-1.5 text-terracotta-700 hover:bg-terracotta-50"
              onClick={onReject}
              disabled={loading}
            >
              <XCircle className="h-4 w-4" />
              Decline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
