'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import {
  formatPaddleNumber,
  paddleChipTier,
  poolNumbers,
} from '@/lib/quarter-auction/paddle-pool'
import { formatCredits, DEFAULT_PADDLE_PURCHASE_CREDITS } from '@/lib/quarter-auction/credits'
import type { EventPaddle, QuarterAuctionSettings } from '@/types/database'

interface PaddleChipPickerProps {
  eventId: string
  settings: QuarterAuctionSettings
  ownedPaddles: EventPaddle[]
  walletBalanceCents: number
  onPurchased: (paddles: EventPaddle[], newBalanceCents: number) => void
}

export function PaddleChipPicker({
  eventId,
  settings,
  ownedPaddles,
  walletBalanceCents,
  onPurchased,
}: PaddleChipPickerProps) {
  const poolSize = settings.paddle_pool_size ?? 100
  const priceCredits = settings.paddle_purchase_credits ?? DEFAULT_PADDLE_PURCHASE_CREDITS
  const numbers = useMemo(() => poolNumbers(poolSize), [poolSize])

  const [taken, setTaken] = useState<Set<string>>(new Set())
  const [cart, setCart] = useState<Set<number>>(new Set())
  const [loadingPool, setLoadingPool] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  const ownedNumbers = useMemo(
    () => new Set(ownedPaddles.map((p) => p.paddle_number)),
    [ownedPaddles]
  )

  const refreshPool = useCallback(async () => {
    setLoadingPool(true)
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/paddles`)
      const json = (await res.json()) as { taken?: string[] }
      if (res.ok) {
        setTaken(new Set(json.taken ?? []))
      }
    } finally {
      setLoadingPool(false)
    }
  }, [eventId])

  useEffect(() => {
    void refreshPool()
  }, [refreshPool])

  const cartTotalCredits = cart.size * priceCredits
  const cartTotalCents = cartTotalCredits * 25
  const canAfford = walletBalanceCents >= cartTotalCents

  function toggleCart(n: number) {
    const label = formatPaddleNumber(n, poolSize)
    if (taken.has(label) || ownedNumbers.has(label)) return
    setCart((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  function removeFromCart(n: number) {
    setCart((prev) => {
      const next = new Set(prev)
      next.delete(n)
      return next
    })
  }

  async function checkout() {
    if (cart.size === 0) {
      toast.error('Add paddle chips to your cart first')
      return
    }
    if (!canAfford) {
      toast.error('Insufficient wallet balance — top up to checkout')
      return
    }

    setCheckingOut(true)
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/paddles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paddle_numbers: [...cart] }),
      })
      const json = (await res.json()) as {
        error?: string
        paddles?: EventPaddle[]
        newBalance?: number
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Checkout failed')
        await refreshPool()
        return
      }
      const purchased = json.paddles ?? []
      onPurchased(purchased, json.newBalance ?? walletBalanceCents - cartTotalCents)
      setCart(new Set())
      setTaken((prev) => {
        const next = new Set(prev)
        for (const p of purchased) next.add(p.paddle_number)
        return next
      })
      toast.success(
        purchased.length === 1
          ? `Paddle #${purchased[0]!.paddle_number} is yours!`
          : `${purchased.length} paddles purchased!`
      )
    } finally {
      setCheckingOut(false)
    }
  }

  const whiteNumbers = numbers.filter((n) => n <= 100)
  const greenNumbers = numbers.filter((n) => n > 100)

  function chipState(n: number) {
    const label = formatPaddleNumber(n, poolSize)
    if (ownedNumbers.has(label)) return 'owned' as const
    if (taken.has(label)) return 'taken' as const
    if (cart.has(n)) return 'selected' as const
    return 'available' as const
  }

  function renderGrid(list: number[]) {
    return (
      <div className="flex flex-wrap gap-2">
        {list.map((n) => {
          const label = formatPaddleNumber(n, poolSize)
          return (
            <PaddleChip
              key={label}
              number={label}
              tier={paddleChipTier(n)}
              state={chipState(n)}
              onClick={() => toggleCart(n)}
              disabled={loadingPool || checkingOut}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Choose your paddle numbers</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tap chips to add to cart — numbers stay open until paid. {formatCredits(priceCredits)} each.
          Item bids use separate per-item entry quarters when bidding opens.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingPool ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading paddle pool…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                White chips · 1–{Math.min(100, poolSize)}
              </p>
              {renderGrid(whiteNumbers)}
            </div>
            {greenNumbers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Green chips · 101–{poolSize}
                </p>
                {renderGrid(greenNumbers)}
              </div>
            ) : null}
          </>
        )}

        <div className="rounded-lg border-2 border-dashed border-stone-200 bg-canvas p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" />
              Cart
            </span>
            <span className="text-sm tabular-nums">
              {cart.size} paddle{cart.size === 1 ? '' : 's'} · {formatCredits(cartTotalCredits)}
            </span>
          </div>
          {cart.size > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {[...cart]
                .sort((a, b) => a - b)
                .map((n) => {
                  const label = formatPaddleNumber(n, poolSize)
                  return (
                    <Badge key={label} variant="secondary" className="gap-1 pr-1 font-mono">
                      #{label}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-stone-300/80"
                        aria-label={`Remove paddle ${label} from cart`}
                        onClick={() => removeFromCart(n)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No paddles selected yet.</p>
          )}
          <Button
            className="w-full"
            disabled={checkingOut || cart.size === 0 || !canAfford}
            onClick={() => void checkout()}
          >
            {checkingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Checkout with wallet (${formatCredits(cartTotalCredits)})`
            )}
          </Button>
          {cart.size > 0 && !canAfford ? (
            <p className="text-xs text-destructive text-center">Not enough quarters in your wallet.</p>
          ) : null}
        </div>

        {ownedPaddles.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your paddles</p>
            <div className="flex flex-wrap gap-1.5">
              {ownedPaddles.map((p) => (
                <Badge key={p.id} className="font-mono">
                  #{p.paddle_number}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
