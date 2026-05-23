'use client'

import { useEffect, useState } from 'react'
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
import { Loader2 } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
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

  const platformFeeCents = config
    ? computePlatformFeeCents(boothPriceCents, config.feeConfig)
    : 0
  const coordinatorPayoutCents = boothPriceCents - platformFeeCents

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
    if (!card) {
      toast.error('Card form not ready')
      return
    }
    if (!config?.squareConnected) {
      toast.error('Coordinator has not connected Square yet')
      return
    }

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
      setPaying(false)
    }
  }

  return (
    <>
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete booth payment</DialogTitle>
            <DialogDescription>{eventName}</DialogDescription>
          </DialogHeader>

          {configLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booth fee</span>
                  <span className="font-semibold">{formatCents(boothPriceCents)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Platform fee (3% + $1)</span>
                  <span>{formatCents(platformFeeCents)}</span>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-medium">
                  <span>You pay</span>
                  <span>{formatCents(boothPriceCents)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Coordinator receives</span>
                  <span>{formatCents(coordinatorPayoutCents)}</span>
                </div>
              </div>

              {!config?.squareConnected ? (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  The coordinator has not connected Square yet. Payment will be available once they finish setup.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Card details</Label>
                    <div
                      ref={setCardContainer}
                      className="min-h-[100px] rounded-lg border p-3"
                    />
                    <p className="text-xs text-gray-400">
                      Secured by Square — card details never touch our servers
                    </p>
                  </div>
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handlePay}
                    disabled={paying || !card}
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
