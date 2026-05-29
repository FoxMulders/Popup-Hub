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
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import {
  EMPTY_STRUCTURED_CARD,
  StructuredCardFields,
  isStructuredCardValid,
  type StructuredCardValue,
} from '@/components/payments/structured-card-fields'
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
  onSuccess?: () => void
}

interface PaymentConfig {
  squareAppId: string
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
  onSuccess,
}: PayBoothModalProps) {
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [cardContainer, setCardContainer] = useState<HTMLDivElement | null>(null)
  const [card, setCard] = useState<SquareCardInstance | null>(null)
  const [paying, setPaying] = useState(false)
  /*
   * Mirror of what's typed in the visible structured-fields grid.
   * The grid is the public-facing UI — the Square iframe below it
   * stays the secure tokenizer (no raw PAN ever leaves the browser
   * via our own state), but pre-validating the typed values lets us
   * disable the Pay button until every field has a sane shape.
   */
  const [cardValue, setCardValue] = useState<StructuredCardValue>(EMPTY_STRUCTURED_CARD)
  const payingRef = useRef(false)

  /*
   * Reset the structured grid every time the modal closes so the next
   * vendor's session opens with empty inputs (avoids "ghost" digits
   * left over from a prior approved-but-unpaid attempt).
   */
  useEffect(() => {
    if (!open) setCardValue(EMPTY_STRUCTURED_CARD)
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

    async function initCard() {
      if (!window.Square || !config?.squareAppId || !config.squareLocationId) return
      try {
        const payments = await window.Square.payments(
          config.squareAppId,
          config.squareLocationId
        )
        // @ts-expect-error Square SDK dynamic
        const newCard = await payments.card()
        await newCard.attach(cardContainer!)
        setCard(newCard)
      } catch {
        toast.error('Could not initialize card form')
      }
    }

    initCard()
  }, [open, squareLoaded, config, cardContainer])

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
    try {
      const result = await card.tokenize()
      if (result.status !== 'OK' || !result.token) {
        toast.error(result.errors?.[0]?.message ?? 'Card error')
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
        toast.error(json.error ?? 'Payment failed')
        return
      }

      toast.success('Payment complete — your booth is confirmed!')
      onOpenChange(false)
      onSuccess?.()
    } finally {
      payingRef.current = false
      setPaying(false)
    }
  }

  return (
    <>
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
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
              {/*
               * Public-facing summary: vendors see ONE line — the
               * booth fee. Internal platform-fee math (3% + $1
               * processing margin) and the coordinator-payout
               * breakdown stay backstage; surfacing them here would
               * leak our pricing model and confuse the buyer who only
               * cares what their card is charged. Coordinators see
               * the full breakdown in their own dashboards.
               */}
              <div className="rounded-lg bg-canvas p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booth fee</span>
                  <span className="font-semibold">{formatCents(boothPriceCents)}</span>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-medium">
                  <span>You pay</span>
                  <span>{formatCents(boothPriceCents)}</span>
                </div>
              </div>

              {!config?.squareConnected ? (
                <p className="text-sm text-harvest-700 bg-harvest-50 rounded-lg p-3">
                  The coordinator has not connected Square yet. Payment will be available once they finish setup.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label className="text-sm">Card details</Label>
                    {/*
                     * Visible structured grid — Card Number / Expiry /
                     * CVC / Postal as four discrete native inputs. This
                     * is what buyers see and interact with first; it
                     * mirrors the layout of every modern checkout form
                     * (Stripe Elements, Apple Pay sheet, etc).
                     */}
                    <StructuredCardFields
                      value={cardValue}
                      onChange={setCardValue}
                      disabled={paying}
                    />

                    {/*
                     * Square's tokenization iframe stays mounted as
                     * the PCI-compliant submission layer. We render
                     * it as a clearly-labeled "Secure submit" panel so
                     * the buyer knows exactly which surface actually
                     * processes the charge — Square's iframe handles
                     * card-data exfiltration to their servers; the
                     * structured grid above is presentation only.
                     */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        Secure submission
                      </p>
                      <div
                        ref={setCardContainer}
                        className="min-h-[60px] rounded-md border bg-white p-3"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Re-enter your card here to authorize payment via Square. Card data
                        never touches our servers.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePay}
                    disabled={paying || !card || !isStructuredCardValid(cardValue)}
                  >
                    {paying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Pay {formatCents(boothPriceCents)}
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
