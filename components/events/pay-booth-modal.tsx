'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { Loader2 } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import type { PlatformFeeMode } from '@/types/database'

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<unknown>
    }
  }
}

interface SquareCardInstance {
  attach: (element: HTMLElement) => Promise<void>
  destroy: () => Promise<void>
  tokenize: () => Promise<{
    status: string
    token?: string
    errors?: { message: string }[]
  }>
}

interface PayBoothModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  eventId: string
  eventName: string
  boothPriceCents: number
  totalChargedCents?: number
  onSuccess?: () => void
}

interface PaymentConfig {
  squareAppId: string | null
  squareLocationId: string | null
  squareConnected: boolean
  feeConfig: {
    mode: PlatformFeeMode
    flatCents: number
    bps: number
  }
}

export function PayBoothModal({
  open,
  onOpenChange,
  applicationId,
  eventId,
  eventName,
  boothPriceCents,
  totalChargedCents,
  onSuccess,
}: PayBoothModalProps) {
  const chargeTotalCents = totalChargedCents ?? boothPriceCents
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [cardContainer, setCardContainer] = useState<HTMLDivElement | null>(null)
  const [card, setCard] = useState<SquareCardInstance | null>(null)
  const [cardInitLoading, setCardInitLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [cardMountKey, setCardMountKey] = useState(0)
  const payingRef = useRef(false)
  const cardRef = useRef<SquareCardInstance | null>(null)

  function retryCardForm() {
    setPaymentError(null)
    setCard(null)
    cardRef.current = null
    setCardMountKey((k) => k + 1)
  }

  useEffect(() => {
    if (!open) {
      setPaymentError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setConfigLoading(true)
    fetch(`/api/events/${eventId}/payment-config`)
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => toast.error('Could not load payment configuration'))
      .finally(() => setConfigLoading(false))
  }, [open, eventId])

  useEffect(() => {
    if (!open || !squareLoaded || !config?.squareLocationId || !cardContainer) return

    let cancelled = false

    async function initCard() {
      if (!window.Square || !config?.squareAppId || !config.squareLocationId) {
        if (!cancelled) {
          setPaymentError(
            'Card checkout is not configured for this market. Ask the coordinator to finish Square setup.'
          )
        }
        return
      }

      setCardInitLoading(true)
      setPaymentError(null)

      try {
        if (cardRef.current) {
          await cardRef.current.destroy().catch(() => undefined)
          cardRef.current = null
        }

        const payments = await window.Square.payments(
          config.squareAppId,
          config.squareLocationId
        )
        // @ts-expect-error Square SDK dynamic
        const newCard = await payments.card()
        if (cancelled) {
          await newCard.destroy().catch(() => undefined)
          return
        }
        await newCard.attach(cardContainer!)
        cardRef.current = newCard
        setCard(newCard)
      } catch (err) {
        if (cancelled) return
        const detail =
          err instanceof Error && err.message.trim().length > 0
            ? err.message
            : 'Could not initialize card form — try again.'
        setPaymentError(detail)
        setCard(null)
        cardRef.current = null
      } finally {
        if (!cancelled) setCardInitLoading(false)
      }
    }

    const timer = window.setTimeout(initCard, 50)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => undefined)
        cardRef.current = null
      }
      setCard(null)
    }
  }, [open, squareLoaded, config, cardContainer, cardMountKey])

  async function handlePay() {
    if (payingRef.current) return
    if (!card) {
      toast.error('Card form not ready')
      return
    }
    if (!config?.squareConnected) {
      toast.error('Coordinator has not connected Square yet')
      return
    }

    payingRef.current = true
    setPaying(true)
    setPaymentError(null)
    try {
      const result = await card.tokenize()
      if (result.status !== 'OK' || !result.token) {
        const message = result.errors?.[0]?.message ?? 'Card error'
        toast.error(message)
        setPaymentError(message)
        return
      }

      const res = await fetch('/api/booth-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: result.token,
          applicationId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const message = json.error ?? 'Payment failed'
        toast.error(message)
        setPaymentError(message)
        return
      }

      toast.success('Payment complete — your booth is confirmed!')
      onOpenChange(false)
      onSuccess?.()
    } catch {
      const message = 'Payment could not be processed — please try again.'
      toast.error(message)
      setPaymentError(message)
    } finally {
      payingRef.current = false
      setPaying(false)
    }
  }

  const squareReady =
    !!config?.squareAppId && !!config?.squareLocationId && config.squareConnected

  return (
    <>
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
        onError={() =>
          setPaymentError('Could not load Square payment SDK — check your connection and try again.')
        }
      />
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (paying && !nextOpen) return
          onOpenChange(nextOpen)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete booth payment</DialogTitle>
            <DialogDescription>{eventName}</DialogDescription>
          </DialogHeader>

          {configLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-canvas p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booth fee</span>
                  <span className="font-semibold">{formatCents(boothPriceCents)}</span>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-medium">
                  <span>You pay</span>
                  <span>{formatCents(chargeTotalCents)}</span>
                </div>
                {chargeTotalCents > boothPriceCents ? (
                  <p className="text-[11px] text-muted-foreground">
                    Includes card &amp; platform processing fees.
                  </p>
                ) : null}
              </div>

              {!config?.squareConnected ? (
                <p className="text-sm text-harvest-700 bg-harvest-50 rounded-lg p-3">
                  The coordinator has not connected Square yet. Payment will be available once they finish setup.
                </p>
              ) : !squareReady ? (
                <p className="text-sm text-harvest-700 bg-harvest-50 rounded-lg p-3">
                  Square is connected but the checkout location is missing. Ask the coordinator to reconnect Square from Payment Methods.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Card details</Label>
                    <div
                      key={cardMountKey}
                      ref={setCardContainer}
                      className="relative min-h-[100px] rounded-lg border bg-white p-3"
                    >
                      {cardInitLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Secured by Square — card details never touch our servers.
                    </p>

                    {paymentError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        <p>{paymentError}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={retryCardForm}
                        >
                          Try again
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePay}
                    disabled={paying || cardInitLoading || !card}
                  >
                    {paying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Pay {formatCents(chargeTotalCents)}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
