'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Send, Clock, AlertTriangle } from 'lucide-react'
import { PayBoothModal } from '@/components/events/pay-booth-modal'
import { PassportApplyPreview } from '@/components/events/passport-apply-preview'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { marketStatusBadge } from '@/lib/theme/market'
import { parseAvailableSlots } from '@/lib/queries/event-capacity'
import {
  isPassportReadyForApplication,
  toPassportApplicationPreview,
  type VendorPassportApplicationPreview,
} from '@/lib/vendor/passport-application'
import {
  categoryNamesForIds,
  resolvePassportCategoryIds,
} from '@/lib/vendor/passport-categories'
import {
  evaluatePassportCategoryMatch,
  formatCategoryOverflowLabel,
  type CategorySlotInfo,
} from '@/lib/vendor/application-category-match'
import {
  daySelectionKey,
  resolveEventScheduleDays,
} from '@/lib/events/event-schedule-days'
import type {
  ApplicationPaymentStatus,
  ApplicationStatus,
  Event,
  EventCategoryLimit,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'
import { VendorPaymentMethodSelector } from '@/components/vendor/vendor-payment-method-selector'
import { formatCents } from '@/lib/square/client'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import {
  formatApplicationPaymentLabel,
  isApplicationPaid,
  needsEtransferCoordinatorReview,
  needsSquareCheckout,
} from '@/lib/applications/payment-fields'
import { categoryRequiresDocumentation } from '@/lib/categories/regulated-categories'
import { uploadApplicationDocument } from '@/lib/vendor/upload-application-document'
import { ApplicationStatusActions, ApplicationStatusBadgeLink } from '@/components/vendor/application-status-actions'
import { hasExistingVendorApplication } from '@/lib/vendor/application-status-ui'
import {
  computeApplicationBoothPriceCents,
  isCommunityMarketListing,
  resolveBoothUnitPriceCents,
} from '@/lib/monetization/booth-pricing'
import { TouchFileInput } from '@/components/ui/touch-file-input'

interface ExistingApplication {
  id: string
  status: ApplicationStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
}

interface ApplyButtonProps {
  event: Event
  userId: string
  applicationStatus?: ApplicationStatus | null
  applicationId?: string | null
  existingApplication?: ExistingApplication | null
  boothPriceCents?: number
  applicationsOpen?: boolean
}

export function ApplyButton({
  event,
  userId,
  applicationStatus = null,
  applicationId = null,
  existingApplication = null,
  boothPriceCents = 0,
  applicationsOpen = true,
}: ApplyButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [passportLoading, setPassportLoading] = useState(false)
  const [passportPreview, setPassportPreview] = useState<VendorPassportApplicationPreview | null>(null)
  const [slots, setSlots] = useState<CategorySlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [standBeside, setStandBeside] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [squareConnected, setSquareConnected] = useState(true)
  const [coordinatorEtransferEmail, setCoordinatorEtransferEmail] = useState<string | null>(null)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null)
  const [pendingBoothPrice, setPendingBoothPrice] = useState(0)
  const [localApplicationStatus, setLocalApplicationStatus] = useState<ApplicationStatus | null>(
    applicationStatus
  )
  const [waitlistConfirmOpen, setWaitlistConfirmOpen] = useState(false)
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(new Set())
  const [termsAcknowledged, setTermsAcknowledged] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('SQUARE')
  const [permitFile, setPermitFile] = useState<File | null>(null)
  const [tableCount, setTableCount] = useState(1)
  const showTableCount = isCommunityMarketListing(event.listing_type)

  const requireFullAttendance = event.require_full_attendance ?? true
  const scheduleDays = useMemo(() => resolveEventScheduleDays(event), [event])

  useEffect(() => {
    setLocalApplicationStatus(applicationStatus)
  }, [applicationStatus])

  useEffect(() => {
    if (existingApplication && needsSquareCheckout(existingApplication)) {
      setPendingApplicationId(existingApplication.id)
      setPendingBoothPrice(boothPriceCents)
    }
  }, [existingApplication, boothPriceCents])

  useEffect(() => {
    if (!open) {
      setSelectedDayKeys(new Set())
      setTermsAcknowledged(false)
      setPermitFile(null)
      setTableCount(1)
      return
    }

    setSelectedDayKeys(new Set(scheduleDays.map((day) => daySelectionKey(day))))
  }, [open, scheduleDays])

  const categoryMatch = useMemo(() => {
    if (!passportPreview) return null
    return evaluatePassportCategoryMatch(
      {
        category_ids: passportPreview.category_ids,
        primary_category_id: passportPreview.primary_category_id,
      },
      slots
    )
  }, [passportPreview, slots])

  const applySlot = categoryMatch?.allCategoriesFull
    ? categoryMatch.passportSlots.find((slot) => slot.categoryId === categoryMatch.waitlistCategoryId) ??
      categoryMatch.passportSlots[0] ??
      null
    : categoryMatch?.resolvedSlot ?? null

  const requiresDocumentation =
    applySlot != null &&
    (applySlot.requiresDocumentation ??
      categoryRequiresDocumentation({
        name: applySlot.categoryName,
        requires_documentation: false,
      }))

  const allCategoriesFull = categoryMatch?.allCategoriesFull ?? false
  const applyUnitPriceCents = applySlot
    ? resolveBoothUnitPriceCents(applySlot.pricePerBooth, event.booth_price_cents ?? 0)
    : 0
  const checkoutBoothPriceCents =
    applySlot && !allCategoriesFull
      ? computeApplicationBoothPriceCents(
          applySlot.pricePerBooth,
          event,
          showTableCount ? tableCount : 1
        )
      : 0
  const requiresPayment = checkoutBoothPriceCents > 0 && !allCategoriesFull
  const isInstant = event.booking_mode === 'instant'
  const partialDaySelectionReady =
    requireFullAttendance || selectedDayKeys.size > 0
  const canSubmitApplication =
    termsAcknowledged &&
    partialDaySelectionReady &&
    !submitting &&
    !slotsLoading &&
    categoryMatch &&
    categoryMatch.passportSlots.length > 0 &&
    (!requiresDocumentation || !!permitFile) &&
    (allCategoriesFull || !requiresPayment || paymentMethod === 'ETRANSFER' || squareConnected)

  function toggleDaySelection(dayKey: string) {
    if (requireFullAttendance) return
    setSelectedDayKeys((prev) => {
      const next = new Set(prev)
      if (next.has(dayKey)) next.delete(dayKey)
      else next.add(dayKey)
      return next
    })
  }

  function buildAttendancePayload() {
    const selectedDays = scheduleDays.filter((day) => selectedDayKeys.has(daySelectionKey(day)))
    return {
      attendingEventDayIds: selectedDays
        .map((day) => day.dayId)
        .filter((dayId): dayId is string => Boolean(dayId)),
      attendingDates: selectedDays.map((day) => day.date),
    }
  }

  async function loadSlots() {
    setSlotsLoading(true)
    try {
      const limits = (event.category_limits ?? []).filter(
        (cl: EventCategoryLimit) => event.allow_mlm || !cl.category?.is_mlm
      )
      const categoryIds = limits.map((cl) => cl.category_id)
      const { data: categoryMeta } = await supabase
        .from('categories')
        .select('id, name, requires_documentation')
        .in('id', categoryIds)

      const metaById = Object.fromEntries((categoryMeta ?? []).map((row) => [row.id, row]))

      const results = await Promise.all(
        limits.map(async (cl: EventCategoryLimit) => {
          const { data } = await supabase.rpc('get_available_slots', {
            p_event_id: event.id,
            p_category_id: cl.category_id,
          })
          const meta = metaById[cl.category_id]
          return {
            categoryId: cl.category_id,
            categoryName: cl.category?.name ?? meta?.name ?? 'Unknown',
            maxSlots: cl.max_slots,
            availableSlots: parseAvailableSlots(data),
            pricePerBooth: cl.price_per_booth,
            requiresDocumentation: categoryRequiresDocumentation(
              meta ?? { name: cl.category?.name ?? '', requires_documentation: false },
            ),
          }
        })
      )
      setSlots(results.sort((a, b) => a.categoryName.localeCompare(b.categoryName)))
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadSlots()
    fetch(`/api/events/${event.id}/payment-config`)
      .then((res) => res.json())
      .then((data: { squareConnected?: boolean; coordinatorEtransferEmail?: string | null }) => {
        setSquareConnected(!!data.squareConnected)
        setCoordinatorEtransferEmail(data.coordinatorEtransferEmail ?? null)
      })
      .catch(() => setSquareConnected(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!squareConnected && requiresPayment) {
      setPaymentMethod('ETRANSFER')
    }
  }, [open, squareConnected, requiresPayment])

  async function handleApplyClick() {
    setPassportLoading(true)
    try {
      const [{ data: passport, error }, { data: profile }] = await Promise.all([
        supabase
          .from('vendor_passports')
          .select(
            'id, business_name, logo_url, primary_category_id, category_ids, tax_id_encrypted, is_verified, category:categories(name)'
          )
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('profiles').select('is_beta_tester').eq('id', userId).maybeSingle(),
      ])

      if (error) {
        toast.error('Could not load your Vendor Passport')
        return
      }

      if (!isPassportReadyForApplication(passport)) {
        toast.error('Please complete your Vendor Passport before applying to markets.')
        router.push('/profile/passport')
        return
      }

      const categoryIds = resolvePassportCategoryIds(passport)
      const { data: categoryRows } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', categoryIds)

      setPassportPreview(
        toPassportApplicationPreview(
          passport,
          categoryNamesForIds(categoryIds, categoryRows ?? []),
          { is_beta_tester: profile?.is_beta_tester ?? false }
        )
      )
      setOpen(true)
    } finally {
      setPassportLoading(false)
    }
  }

  async function submitApplication(joinWaitlist: boolean) {
    const attendance = buildAttendancePayload()

    let applicableDocumentationUrl: string | null = null
    if (requiresDocumentation && permitFile) {
      applicableDocumentationUrl = await uploadApplicationDocument(
        supabase,
        userId,
        permitFile,
        'permit',
      )
    }

    const res = await fetch('/api/vendor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        neighborPreference: standBeside.trim() || null,
        joinWaitlist,
        attendanceTermsAcknowledged: termsAcknowledged,
        attendingEventDayIds: attendance.attendingEventDayIds,
        attendingDates: attendance.attendingDates,
        paymentMethod,
        applicableDocumentationUrl,
        tableCount: showTableCount ? tableCount : 1,
      }),
    })

    const data = (await res.json()) as {
      error?: string
      requiresWaitlist?: boolean
      application?: {
        id: string
        status: ApplicationStatus
        payment_status: string
        waitlist_position?: number | null
      }
      requiresPayment?: boolean
      paymentMethod?: PaymentMethod | null
      paymentStatus?: string | null
      eTransferPendingReview?: boolean
      boothPriceCents?: number
      waitlisted?: boolean
      hasCategoryOverflow?: boolean
    }

    if (!res.ok) {
      if (res.status === 409 && data.requiresWaitlist) {
        setWaitlistConfirmOpen(true)
        return
      }
      if (res.status === 409) {
        setLocalApplicationStatus(data.application?.status ?? 'pending')
      }
      toast.error(data.error ?? 'Failed to submit application')
      return
    }

    const submittedStatus = data.application?.status ?? (isInstant ? 'approved' : 'pending')
    setLocalApplicationStatus(submittedStatus)

    if (data.waitlisted) {
      toast.success(
        data.application?.waitlist_position
          ? `Added to the waitlist (#${data.application.waitlist_position}). We'll notify you if a spot opens.`
          : "Added to the waitlist. We'll notify you if a spot opens from a cancellation."
      )
      setOpen(false)
      setWaitlistConfirmOpen(false)
      router.refresh()
      return
    }

    if (data.eTransferPendingReview) {
      toast.success(
        submittedStatus === 'pending'
          ? 'Application received — send your Interac e-Transfer. Approval is finalized once the coordinator marks payment received.'
          : 'Application approved — send your e-transfer. The coordinator will confirm payment.'
      )
      setOpen(false)
      setWaitlistConfirmOpen(false)
      router.refresh()
      return
    }

    if (submittedStatus === 'pending_insurance') {
      toast.success(
        'Application approved — upload your market insurance proof from My Applications to finalize your booth.',
      )
      setOpen(false)
      setWaitlistConfirmOpen(false)
      router.refresh()
      return
    }

    if (data.requiresPayment && data.application?.id) {
      setPendingApplicationId(data.application.id)
      setPendingBoothPrice(data.boothPriceCents ?? 0)
      setOpen(false)
      setPayModalOpen(true)
      toast.success('Application approved — complete payment to secure your booth.')
      return
    }

    toast.success(
      isInstant
        ? '🎉 Booth confirmed! See you at the market.'
        : data.hasCategoryOverflow
          ? 'Application submitted — coordinator will review your multi-category placement.'
          : '✅ Application submitted! You will pay after the coordinator approves.'
    )
    setOpen(false)
    setWaitlistConfirmOpen(false)
    router.refresh()
  }

  async function handleConfirmSubmit() {
    if (!categoryMatch || categoryMatch.passportSlots.length === 0) {
      toast.error('Your passport categories are not offered at this market')
      return
    }

    if (allCategoriesFull) {
      setWaitlistConfirmOpen(true)
      return
    }

    if (!termsAcknowledged) {
      toast.error('Please agree to the attendance terms before submitting')
      return
    }

    if (!partialDaySelectionReady) {
      toast.error('Select at least one day you plan to attend')
      return
    }

    if (requiresPayment && paymentMethod === 'SQUARE' && !squareConnected) {
      toast.error('Coordinator has not connected Square for paid booths yet')
      return
    }

    setSubmitting(true)
    try {
      await submitApplication(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmWaitlist() {
    if (!termsAcknowledged) {
      toast.error('Please agree to the attendance terms before joining the waitlist')
      return
    }

    setSubmitting(true)
    try {
      await submitApplication(true)
    } finally {
      setSubmitting(false)
    }
  }

  const resolvedApplicationId = applicationId ?? existingApplication?.id ?? null
  const trackedApplicationStatus =
    localApplicationStatus ?? existingApplication?.status ?? applicationStatus

  if (!applicationsOpen && !hasExistingVendorApplication(trackedApplicationStatus)) {
    return (
      <Badge className={`w-full justify-center py-1.5 ${marketStatusBadge.neutral}`}>
        Applications closed
      </Badge>
    )
  }

  // Bug fix: once a market closes its applications, a vendor whose status
  // is still `pending` (or `pending_insurance` without an approved seat)
  // should NOT continue to see "Pending Review" — the organizer can no
  // longer act on a closed market. Show a terminal "Applications closed —
  // not selected" state instead. `waitlisted` survives closure (the user
  // may still get pulled in), and `approved` / `rejected` / `cancelled`
  // are already terminal so the existing branches handle them correctly.
  if (!applicationsOpen && trackedApplicationStatus === 'pending') {
    return (
      <div className="space-y-2">
        <Badge className={`w-full justify-center py-1.5 ${marketStatusBadge.neutral}`}>
          Applications closed — not selected
        </Badge>
        <p className="text-center text-xs text-muted-foreground">
          This market closed before the organizer reviewed your application.
          Discover other open markets to apply again.
        </p>
      </div>
    )
  }

  if (trackedApplicationStatus === 'pending' && resolvedApplicationId) {
    return (
      <ApplicationStatusActions
        event={event}
        applicationId={resolvedApplicationId}
        status="pending"
      />
    )
  }

  if (trackedApplicationStatus === 'pending') {
    return (
      <div className="space-y-2">
        <ApplicationStatusBadgeLink event={event} status="pending" />
        <p className="text-center text-xs text-muted-foreground">
          The organizer is reviewing your application.
        </p>
      </div>
    )
  }

  if (trackedApplicationStatus === 'waitlisted' && resolvedApplicationId) {
    return (
      <ApplicationStatusActions
        event={event}
        applicationId={resolvedApplicationId}
        status="waitlisted"
      />
    )
  }

  if (trackedApplicationStatus === 'waitlisted') {
    return <ApplicationStatusBadgeLink event={event} status="waitlisted" />
  }

  if (trackedApplicationStatus === 'pending_insurance' && resolvedApplicationId) {
    return (
      <ApplicationStatusActions
        event={event}
        applicationId={resolvedApplicationId}
        status="pending_insurance"
      />
    )
  }

  if (trackedApplicationStatus === 'pending_insurance') {
    return <ApplicationStatusBadgeLink event={event} status="pending_insurance" />
  }

  if (trackedApplicationStatus === 'approved') {
    const paymentApp = existingApplication ?? null
    const requiresPaymentNow = paymentApp ? needsSquareCheckout(paymentApp) : false
    const eTransferPending = paymentApp ? needsEtransferCoordinatorReview(paymentApp) : false
    const paid = paymentApp ? isApplicationPaid(paymentApp) : false

    if (requiresPaymentNow) {
      return (
        <>
          <div className="mb-3 space-y-1 rounded-lg bg-harvest-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booth fee</span>
              <span className="font-semibold">{formatCents(boothPriceCents)}</span>
            </div>
            {/*
             * Platform-fee processing margin intentionally hidden
             * from the public vendor view — coordinators see the
             * detailed breakdown on their own dashboards. Vendors
             * see exactly one line: the booth fee they pay.
             */}
            <div className="flex justify-between border-t border-harvest-100 pt-1 font-medium">
              <span>Total due</span>
              <span>{formatCents(boothPriceCents)}</span>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => setPayModalOpen(true)}
          >
            Pay Now to Secure Booth
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Approved — complete payment to confirm your booth.
          </p>
          {pendingApplicationId ? (
            <PayBoothModal
              open={payModalOpen}
              onOpenChange={setPayModalOpen}
              applicationId={pendingApplicationId}
              eventId={event.id}
              eventName={event.name}
              boothPriceCents={pendingBoothPrice}
              onSuccess={() => router.refresh()}
            />
          ) : null}
        </>
      )
    }

    if (eTransferPending) {
      return (
        <div className="space-y-2">
          <Badge className="w-full justify-center bg-sky-100 text-sky-900 py-1.5">
            E-transfer pending review
          </Badge>
          <p className="text-center text-xs text-muted-foreground">
            Send your e-transfer if you haven&apos;t already. The organizer will confirm payment.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Badge className={`w-full justify-center py-1.5 ${marketStatusBadge.success}`}>
          <CheckCircle className="mr-1 h-3 w-3" />
          {paid ? 'Booth confirmed' : 'Approved'}
        </Badge>
        {paymentApp ? (
          <p className="text-center text-xs text-muted-foreground capitalize">
            {formatApplicationPaymentLabel(paymentApp)}
          </p>
        ) : null}
      </div>
    )
  }

  if (trackedApplicationStatus === 'cancelled') {
    return (
      <Badge className={`w-full justify-center py-1.5 ${marketStatusBadge.neutral}`}>
        Application cancelled
      </Badge>
    )
  }

  if (trackedApplicationStatus === 'rejected') {
    return (
      <Badge className={`w-full justify-center py-1.5 ${marketStatusBadge.neutral}`}>
        Not selected
      </Badge>
    )
  }

  const feePreview =
    applySlot && requiresPayment
      ? computePlatformFeeCents(checkoutBoothPriceCents, resolveEventFeeConfig(event))
      : 0

  return (
    <>
      <Button
        size="sm"
        className="w-full"
        onClick={handleApplyClick}
        disabled={passportLoading}
      >
        {passportLoading ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="mr-2 h-3.5 w-3.5" />
        )}
        Apply Now
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {event.name}</DialogTitle>
            <DialogDescription>
              Your passport categories are checked automatically against open booth spots.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {passportPreview ? <PassportApplyPreview passport={passportPreview} /> : null}

            <div className="space-y-2">
              <Label>Your categories at this market</Label>
              {slotsLoading ? (
                <Skeleton className="h-20 w-full rounded-md" />
              ) : categoryMatch && categoryMatch.passportSlots.length > 0 ? (
                <ul className="space-y-1.5 rounded-lg border bg-stone-50 p-3">
                  {categoryMatch.passportSlots.map((slot) => (
                    <li
                      key={slot.categoryId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{slot.categoryName}</span>
                      <span
                        className={
                          slot.availableSlots > 0
                            ? 'text-xs text-sage-700'
                            : 'text-xs font-medium text-harvest-700'
                        }
                      >
                        {slot.availableSlots > 0
                          ? `${slot.availableSlots} of ${slot.maxSlots} spots left`
                          : `Full · ${slot.maxSlots} max`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-harvest-200 bg-harvest-50 p-3 text-sm text-harvest-800">
                  None of your passport categories are offered at this market.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Attendance days</Label>
              {requireFullAttendance ? (
                <div className="rounded-lg border border-harvest-200 bg-harvest-50 p-3 text-sm text-harvest-800">
                  ⚠️ This organizer requires participation for the full duration of the event.
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select each day you plan to attend.
                </p>
              )}
              <ul className="space-y-2 rounded-lg border bg-stone-50 p-3">
                {scheduleDays.map((day) => {
                  const key = daySelectionKey(day)
                  const checked = selectedDayKeys.has(key)
                  return (
                    <li key={key} className="flex items-start gap-3 text-sm">
                      <input
                        id={`attendance-day-${key}`}
                        type="checkbox"
                        checked={checked}
                        disabled={requireFullAttendance}
                        onChange={() => toggleDaySelection(key)}
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-harvest-600 focus:ring-harvest-500 disabled:opacity-70"
                      />
                      <label
                        htmlFor={`attendance-day-${key}`}
                        className={requireFullAttendance ? 'text-foreground' : 'cursor-pointer'}
                      >
                        <span className="font-medium">{day.label}</span>
                        <span className="block text-xs text-muted-foreground">{day.hours}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-1">
              <Label htmlFor="stand-beside">Stand beside (optional)</Label>
              <Input
                id="stand-beside"
                placeholder="e.g. Maple Street Pottery"
                value={standBeside}
                onChange={(e) => setStandBeside(e.target.value)}
              />
            </div>

            {categoryMatch?.hasCategoryOverflow && applySlot ? (
              <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                  Applying under {applySlot.categoryName}
                </p>
                <p className="mt-1 text-violet-900/90">
                  {formatCategoryOverflowLabel(categoryMatch.fullCategoryNames)} — the coordinator
                  will review your placement.
                </p>
              </div>
            ) : null}

            {allCategoriesFull ? (
              <div className="rounded-lg border border-harvest-200 bg-harvest-50 p-3 text-sm text-harvest-800">
                All of your passport categories are full at this market. You can join the waitlist
                and we&apos;ll notify you if a spot opens due to a cancellation.
              </div>
            ) : null}

            {applySlot && !allCategoriesFull && (
              <div className="rounded-lg bg-canvas p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applying as</span>
                  <span className="font-semibold">{applySlot.categoryName}</span>
                </div>
                {showTableCount && applyUnitPriceCents > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="table-count">Tables / booths</Label>
                    <Input
                      id="table-count"
                      type="number"
                      min={1}
                      max={20}
                      value={tableCount}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10)
                        setTableCount(Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 1)
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booth fee</span>
                  <span className="font-semibold">
                    {checkoutBoothPriceCents === 0
                      ? 'Free'
                      : formatCents(checkoutBoothPriceCents)}
                  </span>
                </div>
                {showTableCount && tableCount > 1 && checkoutBoothPriceCents > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {tableCount} tables at {formatCents(applyUnitPriceCents)} each
                    {(event.multi_table_discount_percent ?? 0) > 0
                      ? ` — ${event.multi_table_discount_percent}% multi-table discount applied`
                      : ''}
                  </p>
                ) : null}
                {/*
                 * Public vendor view — platform-fee math is
                 * intentionally hidden. Coordinators see the
                 * processing breakdown on their dashboards.
                 */}
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Mode</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {isInstant ? '⚡ Instant' : '🔍 Juried'}
                  </Badge>
                </div>
              </div>
            )}

            {requiresPayment && (
              <VendorPaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                boothPriceCents={checkoutBoothPriceCents}
                platformFeeCents={feePreview}
                coordinatorEtransferEmail={coordinatorEtransferEmail}
                squareConnected={squareConnected}
                disabled={submitting}
              />
            )}

            {requiresDocumentation && !allCategoriesFull ? (
              <div className="space-y-2">
                <Label>Please upload required permits/documentation *</Label>
                <TouchFileInput
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(files) => setPermitFile(files?.[0] ?? null)}
                  disabled={submitting}
                  label={
                    permitFile
                      ? `Selected: ${permitFile.name}`
                      : 'Tap to upload permits or documentation (PDF or image)'
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Required for {applySlot?.categoryName} vendors at this market.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border bg-stone-50 p-3">
              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={termsAcknowledged}
                  onChange={(e) => setTermsAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-harvest-600 focus:ring-harvest-500"
                />
                <span>
                  {requireFullAttendance
                    ? 'I agree to attend all scheduled days of this market. I understand that arriving late or packing up early violates organizer policy.'
                    : 'I confirm my selected attendance days and agree to be present during the operating hours of those specific dates.'}
                </span>
              </label>
            </div>

            <Button
              className="w-full"
              onClick={handleConfirmSubmit}
              disabled={!canSubmitApplication}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {allCategoriesFull ? 'Join Waitlist' : 'Confirm & Submit Application'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={waitlistConfirmOpen} onOpenChange={setWaitlistConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Join the waitlist?</AlertDialogTitle>
            <AlertDialogDescription>
              All of your passport categories are full for {event.name}. Would you like to join the
              waitlist? We&apos;ll notify you if a vendor cancels and a booth opens up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={() => void handleConfirmWaitlist()}>
              {submitting ? 'Joining…' : 'Yes, join waitlist'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingApplicationId && (
        <PayBoothModal
          open={payModalOpen}
          onOpenChange={setPayModalOpen}
          applicationId={pendingApplicationId}
          eventId={event.id}
          eventName={event.name}
          boothPriceCents={pendingBoothPrice}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
