'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Wallet } from 'lucide-react'
import type {
  AuctionCatalogItem,
  AuctionItemEntry,
  EventPaddle,
  QuarterAuctionSettings,
  Wallet as WalletType,
} from '@/types/database'
import { statusLabel, patronStatusHeadline } from '@/lib/quarter-auction/state-machine'
import { centsToCredits, formatCredits } from '@/lib/quarter-auction/credits'
import { PaddleChipPicker } from '@/components/quarter-auction/paddle-chip-picker'
import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier } from '@/lib/quarter-auction/paddle-pool'
import { PaddleHoldScreen } from '@/components/quarter-auction/paddle-hold-screen'
import { BiddingClosedOverlay } from '@/components/quarter-auction/bidding-closed-overlay'
import { WinnerRevealOverlay } from '@/components/quarter-auction/winner-reveal-overlay'
import { WinCelebration } from '@/components/quarter-auction/win-celebration'
import { playChipTapHaptic } from '@/lib/quarter-auction/celebration-effects'
import {
  AuctionStartCountdown,
  useAuctionCanStart,
} from '@/components/quarter-auction/auction-start-countdown'
import { DismissibleAuctionBanner } from '@/components/auction/dismissible-auction-banner'
import { AuctionParticipationGate } from '@/components/quarter-auction/auction-participation-gate'
import { CharitableImpactTracker } from '@/components/charitable-impact/charitable-impact-tracker'

interface PatronQuarterAuctionLiveProps {
  eventId: string
  eventStartAt: string
  userId: string
  initialItems: AuctionCatalogItem[]
  initialPaddles: EventPaddle[]
  initialWallet: WalletType | null
  settings: QuarterAuctionSettings
}

export function PatronQuarterAuctionLive({
  eventId,
  eventStartAt,
  userId,
  initialItems,
  initialPaddles,
  initialWallet,
  settings,
}: PatronQuarterAuctionLiveProps) {
  const supabase = createClient()
  const canStartAuction = useAuctionCanStart(settings.scheduled_start_at, eventStartAt)
  const [items, setItems] = useState(initialItems)
  const [paddles, setPaddles] = useState(initialPaddles)
  const [wallet, setWallet] = useState(initialWallet)
  const [entries, setEntries] = useState<AuctionItemEntry[]>([])
  const [selectedPaddleIds, setSelectedPaddleIds] = useState<Set<string>>(new Set())
  const [bidding, setBidding] = useState(false)
  const [showWin, setShowWin] = useState(false)
  const [vendorInfo, setVendorInfo] = useState<{
    name: string
    email?: string | null
    phone?: string | null
  } | null>(null)
  const [participated, setParticipated] = useState(false)
  const [bidSpinKeys, setBidSpinKeys] = useState<Record<string, number>>({})
  const [winnerRevealItem, setWinnerRevealItem] = useState<AuctionCatalogItem | null>(null)
  /** Snapshot of the completed item the patron won — survives winner-reveal timeout. */
  const [wonItem, setWonItem] = useState<AuctionCatalogItem | null>(null)

  useEffect(() => {
    void fetch(`/api/quarter-auction/${eventId}/participate`)
      .then((res) => res.json())
      .then((json) => setParticipated(!!json.participated))
      .catch(() => setParticipated(false))
  }, [eventId])

  const inProgressItem = useMemo(
    () =>
      items.find((i) =>
        ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'].includes(i.status)
      ) ?? null,
    [items]
  )

  const liveItem = inProgressItem ?? winnerRevealItem

  const myEntries = useMemo(
    () => entries.filter((e) => e.user_id === userId),
    [entries, userId]
  )

  const myActivePaddleNumbers = myEntries.map((e) => e.paddle_number)
  const balanceCredits = centsToCredits(wallet?.balance ?? 0)

  const loadEntries = useCallback(
    async (itemId: string) => {
      const res = await fetch(`/api/quarter-auction/items/${itemId}/bid`)
      const json = await res.json()
      setEntries(json.entries ?? [])
    },
    []
  )

  useEffect(() => {
    if (liveItem?.id) loadEntries(liveItem.id)
  }, [liveItem?.id, loadEntries])

  useEffect(() => {
    if (!inProgressItem?.id) return
    setEntries([])
    setSelectedPaddleIds(new Set())
    setShowWin(false)
    setWonItem(null)
    setVendorInfo(null)
    setBidSpinKeys({})
  }, [inProgressItem?.id])

  useEffect(() => {
    if (inProgressItem) {
      setWinnerRevealItem(null)
    }
  }, [inProgressItem?.id, inProgressItem])

  useEffect(() => {
    const channel = supabase
      .channel(`qa-patron:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_catalog_items', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as AuctionCatalogItem
          const prev = payload.old as Partial<AuctionCatalogItem> | undefined
          setItems((prevItems) => {
            const idx = prevItems.findIndex((i) => i.id === row.id)
            if (idx === -1) return [...prevItems, row]
            const next = [...prevItems]
            next[idx] = { ...next[idx], ...row }
            return next
          })
          if (
            row.status === 'completed' &&
            row.winning_paddle_number &&
            prev?.status !== 'completed'
          ) {
            setWinnerRevealItem(row)
            if (row.winner_user_id === userId) {
              setWonItem(row)
            }
            window.setTimeout(() => {
              setWinnerRevealItem((current) => (current?.id === row.id ? null : current))
            }, 5500)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_paddles', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as EventPaddle
          if (row.user_id === userId) {
            setPaddles((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, supabase, userId])

  useEffect(() => {
    if (!liveItem?.id) return
    const channel = supabase
      .channel(`qa-entries:${liveItem.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_item_entries', filter: `catalog_item_id=eq.${liveItem.id}` },
        (payload) => {
          setEntries((prev) => [...prev, payload.new as AuctionItemEntry])
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [liveItem?.id, supabase])

  useEffect(() => {
    if (!wonItem?.vendor_id || wonItem.winner_user_id !== userId) return

    let cancelled = false

    async function loadVendor() {
      const { data: vendor } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', wonItem!.vendor_id)
        .single()
      if (cancelled) return
      if (vendor) {
        setVendorInfo({
          name: vendor.full_name,
          email: vendor.email,
          phone: vendor.phone,
        })
      }
      setShowWin(true)
    }
    void loadVendor()

    return () => {
      cancelled = true
    }
  }, [wonItem, userId, supabase])

  async function handlePaddlesPurchased(newPaddles: EventPaddle[], newBalanceCents: number) {
    setPaddles((prev) => [...prev, ...newPaddles])
    if (wallet) {
      setWallet({ ...wallet, balance: newBalanceCents })
    }
  }

  async function placeBid() {
    if (!liveItem || selectedPaddleIds.size === 0) {
      toast.error('Select at least one paddle')
      return
    }
    setBidding(true)
    try {
      const res = await fetch(`/api/quarter-auction/items/${liveItem.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paddle_ids: Array.from(selectedPaddleIds) }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Bid failed')
        return
      }
      setEntries((prev) => [...prev, ...(json.entries ?? [])])
      if (wallet) setWallet({ ...wallet, balance: json.newBalance })
      setSelectedPaddleIds(new Set())
      toast.success('Paddles locked in — hold up your phone!')
    } finally {
      setBidding(false)
    }
  }

  const enteredPaddleIds = new Set(myEntries.map((e) => e.paddle_id))
  const availablePaddles = paddles.filter((p) => !enteredPaddleIds.has(p.id))
  const biddingFrozen =
    liveItem != null && ['bidding_closed', 'drawing'].includes(liveItem.status)
  const showHoldScreen = biddingFrozen && myEntries.length > 0
  const showWinnerReveal =
    !showWin &&
    liveItem?.winning_paddle_number != null &&
    (liveItem.status === 'completed' || winnerRevealItem?.id === liveItem.id)
  const showBiddingClosedOverlay = biddingFrozen && !showHoldScreen && !showWinnerReveal

  const wonPaddle = wonItem?.winning_paddle_number
  const iWon = wonItem?.winner_user_id === userId && wonPaddle != null

  const biddingHeadline = liveItem ? patronStatusHeadline(liveItem.status) : null

  const livePoolCredits = useMemo(
    () => items.map((item) => item.pool_credits ?? 0),
    [items]
  )
  const livePaddleCredits = useMemo(
    () => paddles.map((paddle) => paddle.purchase_credits ?? 0),
    [paddles]
  )

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
      <CharitableImpactTracker
        eventId={eventId}
        livePoolCredits={livePoolCredits}
        livePaddleCredits={livePaddleCredits}
      />

      <DismissibleAuctionBanner scope="quarter-patron-room" id={eventId}>
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3">
          <div>
            <h1 className="text-xl font-bold">Quarter Auction</h1>
            <p className="text-sm text-muted-foreground">
              Balance: {formatCredits(balanceCredits)}
            </p>
          </div>
          <Link href="/wallet" className="text-sm text-forest underline flex items-center gap-1">
            <Wallet className="h-4 w-4" />
            Top up
          </Link>
        </div>
      </DismissibleAuctionBanner>

      <AuctionStartCountdown
        scheduledStartAt={settings.scheduled_start_at}
        eventStartAt={eventStartAt}
      />

      <PaddleChipPicker
        eventId={eventId}
        settings={settings}
        ownedPaddles={paddles}
        walletBalanceCents={wallet?.balance ?? 0}
        canCheckout={participated}
        onPurchased={handlePaddlesPurchased}
      />

      <AuctionParticipationGate
        eventId={eventId}
        loginNext={`/events/${eventId}/quarter-auction`}
        onParticipated={() => setParticipated(true)}
      >
        <>
      {!liveItem ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Waiting for the coordinator to start the next item…
          </CardContent>
        </Card>
      ) : (
        <>
          {biddingHeadline ? (
            <div
              className="rounded-xl border-2 border-harvest-400 bg-harvest-100 px-4 py-5 text-center shadow-[var(--shadow-market)]"
              role="status"
              aria-live="polite"
            >
              <p className="text-xl font-heading font-bold tracking-wide text-harvest-900 sm:text-2xl">
                {biddingHeadline}
              </p>
              <p className="mt-1 text-sm text-harvest-800/90">
                Select your paddles and tap Bid before bidding closes.
              </p>
            </div>
          ) : null}

        <Card className="overflow-hidden">
          {liveItem.image_url && (
            <div className="relative aspect-video bg-canvas">
              <Image
                src={liveItem.image_url}
                alt={liveItem.title}
                fill
                className="object-contain"
                sizes="(max-width: 512px) 100vw, 512px"
              />
            </div>
          )}
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{liveItem.title}</CardTitle>
              <Badge>{biddingHeadline ?? statusLabel(liveItem.status)}</Badge>
            </div>
            {liveItem.description && (
              <p className="text-sm text-muted-foreground">{liveItem.description}</p>
            )}
            {liveItem.entry_cost_credits != null && liveItem.status === 'bidding_open' && (
              <p className="text-sm font-medium">
                Entry for this item: {formatCredits(liveItem.entry_cost_credits)} per paddle
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {liveItem.status === 'active_price_setting' && (
              <p className="text-sm text-center text-muted-foreground" role="status">
                Vendor presentation — bidding opens when the coordinator starts the timer.
              </p>
            )}

            {liveItem.status === 'bidding_open' && !canStartAuction && (
              <p className="text-sm text-center text-muted-foreground" role="status">
                Bidding opens at the advertised start time.
              </p>
            )}

            {liveItem.status === 'bidding_open' && myEntries.length === 0 && canStartAuction && (
              <>
                {availablePaddles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All your paddles are entered or you need to buy a paddle.
                  </p>
                ) : (
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">Tap your paddle chips for this item</legend>
                    <div className="flex flex-wrap gap-2">
                      {availablePaddles.map((p) => {
                        const num = parseInt(p.paddle_number, 10)
                        const tier = Number.isFinite(num) ? paddleChipTier(num) : 'white'
                        const selected = selectedPaddleIds.has(p.id)
                        return (
                          <PaddleChip
                            key={`${p.id}-${bidSpinKeys[p.id] ?? 0}`}
                            number={p.paddle_number}
                            tier={tier}
                            state={selected ? 'selected' : 'owned'}
                            size="lg"
                            selectableOwned
                            spinning={selected}
                            onClick={() => {
                              playChipTapHaptic()
                              setBidSpinKeys((prev) => ({
                                ...prev,
                                [p.id]: (prev[p.id] ?? 0) + 1,
                              }))
                              setSelectedPaddleIds((prev) => {
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
                  </fieldset>
                )}
                <Button
                  className="w-full min-h-12 text-lg"
                  disabled={bidding || selectedPaddleIds.size === 0}
                  onClick={placeBid}
                >
                  {bidding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : selectedPaddleIds.size === 0 ? (
                    'Select paddles to bid (optional)'
                  ) : (
                    `Pay & lock ${selectedPaddleIds.size} paddle${selectedPaddleIds.size === 1 ? '' : 's'} (${formatCredits((liveItem.entry_cost_credits ?? 0) * selectedPaddleIds.size)})`
                  )}
                </Button>
              </>
            )}

            {myEntries.length > 0 && liveItem.status === 'bidding_open' && (
              <p className="text-sm text-center text-forest font-medium" role="status">
                {myEntries.length} paddle(s) locked in — keep {biddingHeadline ?? 'your phone ready'}!
              </p>
            )}

            {liveItem.status === 'completed' && !iWon && !showWinnerReveal && (
              <p className="text-center text-sm" role="status">
                Winner: Paddle #{liveItem.winning_paddle_number ?? '—'}
              </p>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {showBiddingClosedOverlay && liveItem && (
        <BiddingClosedOverlay itemTitle={liveItem.title} hasEntries={myEntries.length > 0} />
      )}

      {showHoldScreen && !showWin && (
        <PaddleHoldScreen paddleNumbers={myActivePaddleNumbers} itemTitle={liveItem!.title} />
      )}

      {showWinnerReveal && liveItem?.winning_paddle_number && (
        <WinnerRevealOverlay
          paddleNumber={liveItem.winning_paddle_number}
          itemTitle={liveItem.title}
          isWinner={iWon}
        />
      )}

      <WinCelebration
        active={showWin && iWon}
        paddleNumber={wonPaddle ?? ''}
        itemTitle={wonItem?.title ?? ''}
        vendorName={vendorInfo?.name}
        vendorContact={vendorInfo ?? undefined}
        onDismiss={() => setShowWin(false)}
      />
        </>
      </AuctionParticipationGate>
    </div>
  )
}
