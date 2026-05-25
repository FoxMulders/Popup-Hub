'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Banknote, Gavel, Loader2, MapPin, Ticket } from 'lucide-react'
import { PatronLookupField } from '@/components/coordinator/patron-lookup-field'
import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier, poolNumbers, formatPaddleNumber } from '@/lib/quarter-auction/paddle-pool'
import { formatCredits, DEFAULT_PADDLE_PURCHASE_CREDITS } from '@/lib/quarter-auction/credits'
import { formatCents } from '@/lib/square/client'
import type { PatronLookupResult } from '@/lib/coordinator/patron-lookup'
import type { AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000]

function parseDeskDollars(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const dollars = parseFloat(trimmed)
  if (!Number.isFinite(dollars) || dollars <= 0) return null
  return Math.round(dollars * 100)
}

interface AuctionClerkDeskProps {
  eventId: string
  settings: QuarterAuctionSettings
  liveItem: AuctionCatalogItem | null
}

export function AuctionClerkDesk({ eventId, settings, liveItem }: AuctionClerkDeskProps) {
  const [patron, setPatron] = useState<PatronLookupResult | null>(null)
  const [amountCents, setAmountCents] = useState(1000)
  const [customDollars, setCustomDollars] = useState('')
  const [busy, setBusy] = useState(false)
  const [cart, setCart] = useState<Set<number>>(new Set())
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const [selectedBidPaddleIds, setSelectedBidPaddleIds] = useState<Set<string>>(new Set())
  const [enteredPaddleIds, setEnteredPaddleIds] = useState<Set<string>>(new Set())
  const patronRefreshSeq = useRef(0)

  const poolSize = settings.paddle_pool_size ?? 100
  const priceCredits = settings.paddle_purchase_credits ?? DEFAULT_PADDLE_PURCHASE_CREDITS
  const numbers = useMemo(() => poolNumbers(poolSize), [poolSize])

  const creditAmountCents = useMemo(() => {
    const parsed = parseDeskDollars(customDollars)
    return parsed ?? amountCents
  }, [customDollars, amountCents])

  const creditAmountValid = creditAmountCents >= 100

  const refreshPatron = useCallback(async (patronId: string) => {
    const seq = ++patronRefreshSeq.current
    const res = await fetch(
      `/api/coordinator/quarter-auction/${eventId}/assist?patronUserId=${encodeURIComponent(patronId)}`
    )
    const json = (await res.json()) as { patron?: PatronLookupResult; taken?: string[]; error?: string }
    if (seq !== patronRefreshSeq.current) return

    if (res.ok && json.patron) {
      setPatron(json.patron)
    }
    if (res.ok && json.taken) {
      setTaken(new Set(json.taken))
    }
  }, [eventId])

  const refreshPool = useCallback(async () => {
    const res = await fetch(`/api/coordinator/quarter-auction/${eventId}/assist`)
    const json = (await res.json()) as { taken?: string[] }
    if (res.ok) setTaken(new Set(json.taken ?? []))
  }, [eventId])

  const loadEnteredPaddles = useCallback(async (itemId: string, patronId: string) => {
    const res = await fetch(`/api/quarter-auction/items/${itemId}/bid`)
    const json = (await res.json()) as { entries?: { paddle_id: string; user_id: string }[] }
    if (!res.ok) return
    const ids = new Set(
      (json.entries ?? [])
        .filter((e) => e.user_id === patronId)
        .map((e) => e.paddle_id)
    )
    setEnteredPaddleIds(ids)
  }, [])

  useEffect(() => {
    void refreshPool()
  }, [refreshPool])

  useEffect(() => {
    setCart(new Set())
    setSelectedBidPaddleIds(new Set())
    setEnteredPaddleIds(new Set())
  }, [patron?.id])

  useEffect(() => {
    if (!liveItem?.id || !patron?.id) {
      setEnteredPaddleIds(new Set())
      setSelectedBidPaddleIds(new Set())
      return
    }
    void loadEnteredPaddles(liveItem.id, patron.id)
    setSelectedBidPaddleIds(new Set())
  }, [liveItem?.id, liveItem?.status, patron?.id, loadEnteredPaddles])

  async function assist(
    action: string,
    extra?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    if (!patron || busy) return null
    setBusy(true)
    try {
      const res = await fetch(`/api/coordinator/quarter-auction/${eventId}/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patronUserId: patron.id, action, ...extra }),
      })
      const json = (await res.json()) as { error?: string; conflictNumbers?: string[] }
      if (!res.ok) {
        toast.error(json.error ?? 'Action failed')
        if (action === 'purchase_paddles' && json.conflictNumbers?.length) {
          await refreshPool()
        }
        if (liveItem?.id && action === 'place_bid') {
          await loadEnteredPaddles(liveItem.id, patron.id)
        }
        return null
      }
      await refreshPatron(patron.id)
      if (action === 'purchase_paddles') {
        setCart(new Set())
      }
      if (action === 'place_bid' && liveItem?.id) {
        setSelectedBidPaddleIds(new Set())
        await loadEnteredPaddles(liveItem.id, patron.id)
      }
      return json
    } catch {
      toast.error('Network error — try again')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function checkIn() {
    const json = await assist('check_in')
    if (json) {
      toast.success(
        json.alreadyRegistered
          ? 'Patron was already checked in'
          : 'Patron checked in for the auction'
      )
    }
  }

  async function creditCash() {
    if (!creditAmountValid) {
      toast.error('Minimum top-up is $1.00')
      return
    }
    const json = await assist('cash_top_up', { amountCents: creditAmountCents })
    if (json) {
      toast.success(`Added ${formatCents(creditAmountCents)} to wallet`)
      setCustomDollars('')
    }
  }

  async function purchasePaddles() {
    if (cart.size === 0) {
      toast.error('Select paddle numbers first')
      return
    }
    const json = await assist('purchase_paddles', { paddle_numbers: [...cart] })
    if (json) toast.success('Paddle numbers assigned')
  }

  async function placeBid() {
    if (!liveItem || liveItem.status !== 'bidding_open') {
      toast.error('Bidding is not open on the current item')
      return
    }
    if (selectedBidPaddleIds.size === 0) {
      toast.error('Select at least one paddle')
      return
    }
    const json = await assist('place_bid', {
      catalogItemId: liveItem.id,
      paddle_ids: [...selectedBidPaddleIds],
    })
    if (json) {
      toast.success('Bid entered — tell patron to hold up their paddle number(s)')
    }
  }

  const ownedNumbers = new Set(patron?.paddles.map((p) => p.paddle_number) ?? [])

  function toggleCart(n: number) {
    if (busy) return
    const label = formatPaddleNumber(n, poolSize)
    if (taken.has(label) || ownedNumbers.has(label)) return
    setCart((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const entryCredits = liveItem?.entry_cost_credits ?? 0
  const bidTotalCredits = entryCredits * selectedBidPaddleIds.size

  const bidEligiblePaddles =
    patron?.paddles.filter((p) => !enteredPaddleIds.has(p.id)) ?? []

  return (
    <Card className="border-forest/30 bg-forest/5">
      <CardHeader>
        <CardTitle className="text-lg">Registration desk — no smartphone</CardTitle>
        <p className="text-sm text-muted-foreground">
          For patrons without a phone: look them up (or create a walk-up account), take cash, assign
          paddle numbers, and enter bids from this desk.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <PatronLookupField
          eventId={eventId}
          selectedPatronId={patron?.id ?? null}
          onSelect={setPatron}
          onClear={() => setPatron(null)}
        />

        {patron ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant={patron.participated ? 'default' : 'outline'}>
                {patron.participated ? 'Checked in' : 'Not checked in'}
              </Badge>
              <Badge variant="secondary">
                Balance: {formatCredits(patron.walletBalanceCredits)}
              </Badge>
              {patron.walletNumber ? (
                <Badge variant="outline" className="font-mono">
                  Wallet #{patron.walletNumber}
                </Badge>
              ) : null}
              {patron.paddles.length > 0 ? (
                <Badge variant="outline">{patron.paddles.length} paddle(s)</Badge>
              ) : null}
            </div>

            {!patron.participated ? (
              <Button
                type="button"
                className="w-full min-h-11 gap-2"
                disabled={busy}
                onClick={() => void checkIn()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                Check in at event (staff verified)
              </Button>
            ) : null}

            <div className="rounded-xl border bg-white p-4 space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Banknote className="h-4 w-4 text-forest" />
                Cash top-up
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setAmountCents(cents)
                      setCustomDollars('')
                    }}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                      !customDollars && amountCents === cents
                        ? 'border-forest bg-forest/10 text-forest'
                        : 'border-stone-200'
                    }`}
                  >
                    {formatCents(cents)}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="Custom amount ($)"
                value={customDollars}
                disabled={busy}
                onChange={(e) => setCustomDollars(e.target.value)}
                className="min-h-10"
              />
              {customDollars && !creditAmountValid ? (
                <p className="text-xs text-destructive">Enter a valid amount of at least $1.00</p>
              ) : null}
              <Button
                type="button"
                className="w-full min-h-11 bg-forest hover:bg-forest-deep"
                disabled={busy || !creditAmountValid}
                onClick={() => void creditCash()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Credit ${formatCents(creditAmountCents)}`
                )}
              </Button>
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Ticket className="h-4 w-4 text-forest" />
                Assign paddle numbers ({formatCredits(priceCredits)} each)
              </p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {numbers.slice(0, poolSize).map((n) => {
                  const label = formatPaddleNumber(n, poolSize)
                  const owned = ownedNumbers.has(label)
                  const isTaken = taken.has(label)
                  const state = owned
                    ? ('owned' as const)
                    : isTaken
                      ? ('taken' as const)
                      : cart.has(n)
                        ? ('selected' as const)
                        : ('available' as const)
                  return (
                    <PaddleChip
                      key={label}
                      number={label}
                      tier={paddleChipTier(n)}
                      state={state}
                      size="md"
                      onClick={() => toggleCart(n)}
                      disabled={owned || isTaken || busy}
                    />
                  )
                })}
              </div>
              <Button
                type="button"
                className="w-full min-h-11"
                disabled={busy || cart.size === 0}
                onClick={() => void purchasePaddles()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Assign ${cart.size || ''} paddle${cart.size === 1 ? '' : 's'}`
                )}
              </Button>
              {patron.paddles.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Their numbers:{' '}
                  {patron.paddles.map((p) => `#${p.paddle_number}`).join(', ')} — write on a card or
                  give physical chips.
                </p>
              ) : null}
            </div>

            {liveItem && liveItem.status === 'bidding_open' && patron.paddles.length > 0 ? (
              <div className="rounded-xl border-2 border-harvest-300 bg-harvest-50 p-4 space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium text-harvest-900">
                  <Gavel className="h-4 w-4" />
                  Enter bid — {liveItem.title}
                </p>
                <p className="text-xs text-harvest-800">
                  {formatCredits(entryCredits)} per paddle · tap their paddle(s) when they raise them
                </p>
                {bidEligiblePaddles.length === 0 ? (
                  <p className="text-sm text-harvest-800">
                    All of this patron&apos;s paddles are already entered for this item.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {bidEligiblePaddles.map((p) => {
                        const num = parseInt(p.paddle_number, 10)
                        const tier = Number.isFinite(num) ? paddleChipTier(num) : 'white'
                        const selected = selectedBidPaddleIds.has(p.id)
                        return (
                          <PaddleChip
                            key={p.id}
                            number={p.paddle_number}
                            tier={tier}
                            state={selected ? 'selected' : 'owned'}
                            size="lg"
                            selectableOwned
                            disabled={busy}
                            onClick={() => {
                              setSelectedBidPaddleIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(p.id)) next.delete(p.id)
                                else next.add(p.id)
                                return next
                              })
                            }}
                          />
                        )
                      })}
                    </div>
                    <Button
                      type="button"
                      className="w-full min-h-12 text-base"
                      disabled={busy || selectedBidPaddleIds.size === 0}
                      onClick={() => void placeBid()}
                    >
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        `Enter bid (${formatCredits(bidTotalCredits)})`
                      )}
                    </Button>
                  </>
                )}
                {enteredPaddleIds.size > 0 ? (
                  <p className="text-xs text-harvest-700">
                    Already entered:{' '}
                    {patron.paddles
                      .filter((p) => enteredPaddleIds.has(p.id))
                      .map((p) => `#${p.paddle_number}`)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
            ) : liveItem ? (
              <p className="text-sm text-muted-foreground text-center">
                Current item: {liveItem.title} — bidding is {liveItem.status.replace(/_/g, ' ')}.
              </p>
            ) : null}

            {patron.walletNumber ? (
              <div className="rounded-lg border border-dashed bg-white p-3 text-center text-sm">
                <p className="font-medium">Exit card — save for cash reclaim</p>
                <p className="mt-1 text-2xl font-mono font-bold">{patron.full_name}</p>
                <p className="text-lg font-mono text-forest">Wallet #{patron.walletNumber}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
