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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Send } from 'lucide-react'
import type { Event, EventCategoryLimit } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import Script from 'next/script'

interface ApplyButtonProps {
  event: Event
  passportId: string
  userId: string
  alreadyApplied: boolean
}

interface SlotInfo {
  categoryId: string
  categoryName: string
  maxSlots: number
  availableSlots: number
  pricePerBooth: number
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<unknown>
    }
  }
}

export function ApplyButton({ event, passportId, userId, alreadyApplied }: ApplyButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [cardContainer, setCardContainer] = useState<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [card, setCard] = useState<any>(null)

  const selectedSlot = slots.find((s) => s.categoryId === selectedCategoryId)
  const requiresPayment = (selectedSlot?.pricePerBooth ?? 0) > 0

  async function loadSlots() {
    setSlotsLoading(true)
    try {
      const limits = (event.category_limits ?? []).filter(
        (cl: EventCategoryLimit) => event.allow_mlm || !cl.category?.is_mlm
      )
      const results = await Promise.all(
        limits.map(async (cl: EventCategoryLimit) => {
          const { data } = await supabase
            .rpc('get_available_slots', {
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
      setSlots(results)
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && squareLoaded && requiresPayment && cardContainer) {
      initSquareCard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, squareLoaded, requiresPayment, selectedCategoryId, cardContainer])

  async function initSquareCard() {
    if (!window.Square) return
    try {
      const payments = await window.Square.payments(
        process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
      )
      // @ts-expect-error Square SDK dynamic
      const newCard = await payments.card()
      if (cardContainer) {
        await newCard.attach(cardContainer)
        setCard(newCard)
      }
    } catch {
      // Square SDK not available in this environment
    }
  }

  async function handleApply() {
    if (!selectedCategoryId) {
      toast.error('Please select a category')
      return
    }
    setSubmitting(true)

    try {
      let squarePaymentId: string | null = null

      if (requiresPayment && card) {
        const result = await card.tokenize()
        if (result.status !== 'OK') {
          toast.error(result.errors?.[0]?.message ?? 'Card error')
          setSubmitting(false)
          return
        }

        const res = await fetch('/api/booth-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: result.token,
            eventId: event.id,
            categoryId: selectedCategoryId,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Payment failed')
          setSubmitting(false)
          return
        }
        squarePaymentId = json.paymentId
      }

      const { error } = await supabase.from('booth_applications').insert({
        event_id: event.id,
        vendor_id: userId,
        category_id: selectedCategoryId,
        status: event.booking_mode === 'instant' ? 'approved' : 'pending',
        payment_status: requiresPayment && squarePaymentId ? 'paid' : 'unpaid',
        square_payment_id: squarePaymentId,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already applied to this event.')
        } else {
          toast.error(error.message)
        }
        setSubmitting(false)
        return
      }

      toast.success(
        event.booking_mode === 'instant'
          ? '🎉 Booth confirmed! See you at the market.'
          : '✅ Application submitted! The coordinator will review it.'
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

  return (
    <>
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
      />
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
              Select a category and submit your application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Category</Label>
              {slotsLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v ?? '')}>
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
                          <span className={`text-xs ${slot.availableSlots > 0 ? 'text-green-600' : 'text-gray-400 line-through'}`}>
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

            {selectedSlot && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booth fee</span>
                  <span className="font-semibold">
                    {selectedSlot.pricePerBooth === 0
                      ? 'Free'
                      : formatCents(selectedSlot.pricePerBooth)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">Mode</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {event.booking_mode === 'instant' ? '⚡ Instant' : '🔍 Juried'}
                  </Badge>
                </div>
              </div>
            )}

            {requiresPayment && (
              <div className="space-y-1">
                <Label>Card Details</Label>
                <div
                  ref={setCardContainer}
                  className="min-h-[100px] rounded-lg border p-3"
                />
                <p className="text-xs text-gray-400">
                  Secured by Square — card details never touch our servers
                </p>
              </div>
            )}

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleApply}
              disabled={submitting || !selectedCategoryId || slotsLoading}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {requiresPayment
                ? `Pay ${selectedSlot ? formatCents(selectedSlot.pricePerBooth) : ''} & Apply`
                : 'Submit Application'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
