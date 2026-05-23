'use client'

import { useState, useEffect } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Send, HelpCircle, Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import type { ApplicationStatus, Event, EventCategoryLimit } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { computePlatformFeeCents } from '@/lib/monetization/fees'

interface ApplyButtonProps {
  event: Event
  userId: string
  applicationStatus?: ApplicationStatus | null
  applicationsOpen?: boolean
}

interface SlotInfo {
  categoryId: string
  categoryName: string
  maxSlots: number
  availableSlots: number
  pricePerBooth: number
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
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
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

  useEffect(() => {
    setLocalApplicationStatus(applicationStatus)
  }, [applicationStatus])

  const selectedSlot = slots.find((s) => s.categoryId === selectedCategoryId)
  const selectedCategoryFull = (selectedSlot?.availableSlots ?? 0) <= 0
  const requiresPayment = (selectedSlot?.pricePerBooth ?? 0) > 0 && !selectedCategoryFull
  const isInstant = event.booking_mode === 'instant'

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
      const { data: passport, error } = await supabase
        .from('vendor_passports')
        .select(
          'id, business_name, logo_url, primary_category_id, category_ids, tax_id_encrypted, is_verified, category:categories(name)'
        )
        .eq('user_id', userId)
        .maybeSingle()

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
          categoryNamesForIds(categoryIds, categoryRows ?? [])
        )
      )
      setOpen(true)
    } finally {
      setPassportLoading(false)
    }
  }

  async function submitApplication(joinWaitlist: boolean) {
    const res = await fetch('/api/vendor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        categoryId: selectedCategoryId,
        neighborPreference: standBeside.trim() || null,
        joinWaitlist,
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
        : '✅ Application submitted! You will pay after the coordinator approves.'
    )
    setOpen(false)
    setWaitlistConfirmOpen(false)
    router.refresh()
  }

  async function handleConfirmSubmit() {
    if (!selectedCategoryId) {
      toast.error('Please select a category')
      return
    }

    if (selectedCategoryFull) {
      setWaitlistConfirmOpen(true)
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
    selectedSlot && requiresPayment
      ? computePlatformFeeCents(selectedSlot.pricePerBooth, {
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
              Review your passport and booth details, then submit your application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {passportPreview ? <PassportApplyPreview passport={passportPreview} /> : null}

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label>Category</Label>
                <Tooltip>
                  <TooltipTrigger type="button">
                    <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Select the category that best matches what you&apos;re selling.
                  </TooltipContent>
                </Tooltip>
              </div>
              {slotsLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Select
                  value={selectedCategoryId}
                  onValueChange={(v) => setSelectedCategoryId(v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => (
                      <SelectItem
                        key={slot.categoryId}
                        value={slot.categoryId}
                      >
                        <div className="flex w-full items-center justify-between gap-4">
                          <span>{slot.categoryName}</span>
                          <span
                            className={`text-xs ${
                              slot.availableSlots > 0
                                ? 'text-green-600'
                                : 'text-amber-700 font-medium'
                            }`}
                          >
                            {slot.availableSlots > 0
                              ? `${slot.availableSlots} of ${slot.maxSlots} spots left`
                              : `Full · ${slot.maxSlots} max (waitlist)`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

            {selectedCategoryFull ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This category is currently full. You can join the waitlist and we&apos;ll notify you
                if a spot opens due to a cancellation.
              </div>
            ) : null}

            {selectedSlot && !selectedCategoryFull && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booth fee</span>
                  <span className="font-semibold">
                    {selectedSlot.pricePerBooth === 0
                      ? 'Free'
                      : formatCents(selectedSlot.pricePerBooth)}
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

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleConfirmSubmit}
              disabled={
                submitting ||
                !selectedCategoryId ||
                slotsLoading ||
                (!selectedCategoryFull && requiresPayment && !squareConnected)
              }
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {selectedCategoryFull ? 'Join Waitlist' : 'Confirm & Submit Application'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={waitlistConfirmOpen} onOpenChange={setWaitlistConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Join the waitlist?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSlot?.categoryName ?? 'This category'} is full for {event.name}. Would you
              like to join the waitlist? We&apos;ll notify you if a vendor cancels and a booth
              opens up.
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

