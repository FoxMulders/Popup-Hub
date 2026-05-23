'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
import { Loader2, CheckCircle, Send, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PayBoothModal } from '@/components/events/pay-booth-modal'
import type { Event, EventCategoryLimit } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { computePlatformFeeCents } from '@/lib/monetization/fees'

interface ApplyButtonProps {
  event: Event
  passportId: string
  userId: string
  alreadyApplied: boolean
  hasCoordinatorApproval: boolean
  coordinatorId: string
  coordinatorName: string
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
  alreadyApplied,
  hasCoordinatorApproval,
  coordinatorId,
  coordinatorName,
}: ApplyButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [standBeside, setStandBeside] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [squareConnected, setSquareConnected] = useState(true)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null)
  const [pendingBoothPrice, setPendingBoothPrice] = useState(0)

  const selectedSlot = slots.find((s) => s.categoryId === selectedCategoryId)
  const requiresPayment = (selectedSlot?.pricePerBooth ?? 0) > 0
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
            availableSlots: (data as number) ?? 0,
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

  async function handleApply() {
    if (!selectedCategoryId) {
      toast.error('Please select a category')
      return
    }

    if (requiresPayment && !squareConnected) {
      toast.error('Coordinator has not connected Square for paid booths yet')
      return
    }

    setSubmitting(true)

    try {
      const isApproved = isInstant
      const paymentStatus =
        requiresPayment && isApproved ? 'payment_required' : 'unpaid'

      const { data: inserted, error } = await supabase
        .from('booth_applications')
        .insert({
          event_id: event.id,
          vendor_id: userId,
          category_id: selectedCategoryId,
          status: isApproved ? 'approved' : 'pending',
          payment_status: paymentStatus,
          neighbor_preference: standBeside.trim() || null,
          ...(isApproved ? { approved_at: new Date().toISOString() } : {}),
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already applied to this event.')
        } else {
          toast.error(error.message)
        }
        return
      }

      if (requiresPayment && isInstant && inserted?.id) {
        setPendingApplicationId(inserted.id)
        setPendingBoothPrice(selectedSlot?.pricePerBooth ?? 0)
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
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyApplied) {
    return (
      <Badge className="w-full justify-center bg-green-100 text-green-700 py-1.5">
        <CheckCircle className="mr-1 h-3 w-3" />
        Applied
      </Badge>
    )
  }

  if (!hasCoordinatorApproval) {
    return (
      <Link
        href={`/coordinators/${coordinatorId}`}
        className="inline-flex w-full min-h-10 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-center text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        Request access from {coordinatorName} first
      </Link>
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
        onClick={() => setOpen(true)}
      >
        <Send className="mr-2 h-3.5 w-3.5" />
        Apply Now
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {event.name}</DialogTitle>
            <DialogDescription>
              {isInstant
                ? 'Select a category and submit. Paid booths require payment after approval.'
                : 'Select a category and submit. Payment is collected after the coordinator approves.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                        disabled={slot.availableSlots <= 0}
                      >
                        <div className="flex w-full items-center justify-between gap-4">
                          <span>{slot.categoryName}</span>
                          <span
                            className={`text-xs ${
                              slot.availableSlots > 0
                                ? 'text-green-600'
                                : 'text-gray-400 line-through'
                            }`}
                          >
                            {slot.availableSlots > 0
                              ? `${slot.availableSlots} spot${slot.availableSlots !== 1 ? 's' : ''} left`
                              : 'Full'}
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

            {selectedSlot && (
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
              onClick={handleApply}
              disabled={
                submitting ||
                !selectedCategoryId ||
                slotsLoading ||
                (requiresPayment && !squareConnected)
              }
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
