'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import type { ApplicationStatus, Event, EventCategoryLimit } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { computePlatformFeeCents } from '@/lib/monetization/fees'

interface ApplyButtonProps {
  event: Event
  userId: string
  applicationStatus?: ApplicationStatus | null
  applicationsOpen?: boolean
}

export function ApplyButton({
  event,
  userId,
  applicationStatus = null,
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
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null)
  const [pendingBoothPrice, setPendingBoothPrice] = useState(0)
  const [localApplicationStatus, setLocalApplicationStatus] = useState<ApplicationStatus | null>(
    applicationStatus
  )
  const [waitlistConfirmOpen, setWaitlistConfirmOpen] = useState(false)
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(new Set())
  const [termsAcknowledged, setTermsAcknowledged] = useState(false)

  const requireFullAttendance = event.require_full_attendance ?? true
  const scheduleDays = useMemo(() => resolveEventScheduleDays(event), [event])

  useEffect(() => {
    setLocalApplicationStatus(applicationStatus)
  }, [applicationStatus])

  useEffect(() => {
    if (!open) {
      setSelectedDayKeys(new Set())
      setTermsAcknowledged(false)
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

  const allCategoriesFull = categoryMatch?.allCategoriesFull ?? false
  const requiresPayment = (applySlot?.pricePerBooth ?? 0) > 0 && !allCategoriesFull
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
    (allCategoriesFull || !requiresPayment || squareConnected)

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
      const results = await Promise.all(
        limits.map(async (cl: EventCategoryLimit) => {
          const { data } = await supabase.rpc('get_available_slots', {
            p_event_id: event.id,
            p_category_id: cl.category_id,
          })
          return {
            categoryId: cl.category_id,
            categoryName: cl.category?.name ?? 'Unknown',
            maxSlots: cl.max_slots,
            availableSlots: parseAvailableSlots(data),
            pricePerBooth: cl.price_per_booth,
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
      .then((data) => setSquareConnected(!!data.squareConnected))
      .catch(() => setSquareConnected(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
        router.push('/vendor/passport')
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

    if (requiresPayment && !squareConnected) {
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

  if (!applicationsOpen) {
    return (
      <Badge className="w-full justify-center bg-stone-100 text-stone-600 py-1.5">
        Applications closed
      </Badge>
    )
  }

  if (localApplicationStatus === 'pending') {
    return (
      <Button size="sm" className="w-full" variant="secondary" disabled>
        <Clock className="mr-2 h-3.5 w-3.5" />
        Application Pending
      </Button>
    )
  }

  if (localApplicationStatus === 'waitlisted') {
    return (
      <Badge className="w-full justify-center bg-amber-100 text-amber-800 py-1.5">
        Waitlisted
      </Badge>
    )
  }

  if (localApplicationStatus === 'approved' || localApplicationStatus === 'cancelled') {
    return (
      <Badge className="w-full justify-center bg-green-100 text-green-700 py-1.5">
        <CheckCircle className="mr-1 h-3 w-3" />
        Applied
      </Badge>
    )
  }

  if (localApplicationStatus === 'rejected') {
    return (
      <Badge className="w-full justify-center bg-stone-100 text-stone-600 py-1.5">
        Not selected
      </Badge>
    )
  }

  const feePreview =
    applySlot && requiresPayment
      ? computePlatformFeeCents(applySlot.pricePerBooth, {
          mode: 'percent_plus_flat',
          flatCents: 100,
          bps: 300,
        })
      : 0

  return (
    <>
      <Button
        size="sm"
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
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
                            ? 'text-xs text-green-700'
                            : 'text-xs font-medium text-amber-800'
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
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  None of your passport categories are offered at this market.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Attendance days</Label>
              {requireFullAttendance ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 disabled:opacity-70"
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                All of your passport categories are full at this market. You can join the waitlist
                and we&apos;ll notify you if a spot opens due to a cancellation.
              </div>
            ) : null}

            {applySlot && !allCategoriesFull && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Applying as</span>
                  <span className="font-semibold">{applySlot.categoryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Booth fee</span>
                  <span className="font-semibold">
                    {applySlot.pricePerBooth === 0
                      ? 'Free'
                      : formatCents(applySlot.pricePerBooth)}
                  </span>
                </div>
                {requiresPayment && (
                  <div className="flex justify-between text-gray-500">
                    <span>Platform fee (3% + $1)</span>
                    <span>{formatCents(feePreview)}</span>
                  </div>
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">Mode</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {isInstant ? '⚡ Instant' : '🔍 Juried'}
                  </Badge>
                </div>
              </div>
            )}

            {requiresPayment && !squareConnected && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                This event has paid booths, but the coordinator has not connected Square yet.
              </p>
            )}

            <div className="rounded-lg border bg-stone-50 p-3">
              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={termsAcknowledged}
                  onChange={(e) => setTermsAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  {requireFullAttendance
                    ? 'I agree to attend all scheduled days of this market. I understand that arriving late or packing up early violates organizer policy.'
                    : 'I confirm my selected attendance days and agree to be present during the operating hours of those specific dates.'}
                </span>
              </label>
            </div>

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
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
