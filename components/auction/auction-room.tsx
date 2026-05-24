'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { buildLeaderboard } from '@/lib/auction/winner'
import type { Auction, AuctionDrop, Wallet } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { Trophy, Zap, Clock, Users, Coins, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface AuctionRoomProps {
  auction: Auction
  drops?: AuctionDrop[]
  wallet: Wallet | null
  userId: string
  eventId?: string | null
}

export function AuctionRoom({
  auction: initialAuction,
  drops: initialDrops,
  wallet: initialWallet,
  userId,
  eventId,
}: AuctionRoomProps) {
  const supabase = createClient()

  const [auction, setAuction] = useState<Auction>(initialAuction)
  const [drops, setDrops] = useState<AuctionDrop[]>(initialDrops ?? initialAuction.drops ?? [])
  const [wallet, setWallet] = useState<Wallet | null>(initialWallet)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [dropping, setDropping] = useState(false)
  const [dropAmount, setDropAmount] = useState(auction.min_drop_amount)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = localStorage.getItem('auction_onboarding_dismissed')
    if (!dismissed && !wallet?.paddle_id) setShowOnboarding(true)
  }, [wallet?.paddle_id])

  const leaderboard = buildLeaderboard(drops)
  const totalPotCents = drops.reduce((sum, d) => sum + d.amount, 0)
  const myDrops = drops.filter((d) => d.user_id === userId)
  const myTotalCents = myDrops.reduce((sum, d) => sum + d.amount, 0)
  const paddleId = wallet?.paddle_id

  useEffect(() => {
    if (auction.status !== 'active' || !auction.timer_ends_at) return
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(auction.timer_ends_at!).getTime() - Date.now()) / 1000)
      )
      setTimeLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [auction.status, auction.timer_ends_at])

  useEffect(() => {
    const dropsChannel = supabase
      .channel(`auction-drops:${auction.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_drops', filter: `auction_id=eq.${auction.id}` },
        (payload) => setDrops((prev) => [...prev, payload.new as AuctionDrop])
      )
      .subscribe()

    const auctionChannel = supabase
      .channel(`auction:${auction.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auction.id}` },
        (payload) => {
          setAuction((prev) => ({ ...prev, ...(payload.new as Auction) }))
          if (payload.new.status === 'ended') {
            if (payload.new.winning_paddle_id) {
              const isWinner = payload.new.winning_paddle_id === paddleId
              if (isWinner) {
                toast.success('🎉 You won the auction!', { duration: 8000 })
              } else {
                toast.info(`Auction ended! Winner: Paddle #${payload.new.winning_paddle_id}`)
              }
            } else {
              toast.info('Auction ended with no drops.')
            }
          }
        }
      )
      .subscribe()

    const walletChannel = supabase
      .channel(`wallet:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
        (payload) => setWallet(payload.new as Wallet)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(dropsChannel)
      supabase.removeChannel(auctionChannel)
      supabase.removeChannel(walletChannel)
    }
  }, [auction.id, userId, paddleId, supabase])

  async function handleDrop() {
    if (!paddleId) { toast.error('You need a paddle ID. Top up your wallet first.'); return }
    if (!wallet || wallet.balance < dropAmount) { toast.error('Insufficient wallet balance.'); return }

    setDropping(true)
    try {
      const res = await fetch(`/api/auction/${auction.id}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: dropAmount }),
      })
      const json = await res.json()
      if (!res.ok) toast.error(json.error ?? 'Drop failed')
      else toast.success(`💰 Dropped ${formatCents(dropAmount)}!`)
    } finally {
      setDropping(false)
    }
  }

  const timerPercent = auction.timer_ends_at ? (timeLeft / auction.timer_duration_seconds) * 100 : 0
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const dropOptions = Array.from(
    new Set([auction.min_drop_amount, Math.round((auction.min_drop_amount + auction.max_drop_amount) / 2), auction.max_drop_amount])
  )

  const isDrawing = auction.status === 'active' && timeLeft === 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {showOnboarding && (
        <div
          className="rounded-xl border border-harvest-200 bg-harvest-50 p-4"
          role="note"
          aria-label="How quarter auctions work"
        >
          <p className="font-semibold text-harvest-800">New to quarter auctions?</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-harvest-700">
            <li>Top up your wallet to get a permanent Paddle ID.</li>
            <li>Drop quarters during the live timer — each drop is an entry to win.</li>
            <li>When time runs out, a random paddle is drawn from all entries.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-harvest-600 hover:bg-harvest-700"
              onClick={() => { window.location.href = '/wallet' }}
            >
              Top up wallet
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.setItem('auction_onboarding_dismissed', '1')
                setShowOnboarding(false)
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {eventId && (
        <p className="text-sm text-muted-foreground">
          <a href={`/events/${eventId}`} className="font-medium text-forest underline">
            ← Back to event listing
          </a>
        </p>
      )}

      <Card className={`overflow-hidden border-2 ${auction.status === 'active' ? 'border-harvest-400' : 'border-stone-200'}`}>
        <div className="relative">
          {auction.item_image_url && (
            <img src={auction.item_image_url} alt={auction.item_name} className="h-56 w-full object-cover" />
          )}
          <Badge className={`absolute left-3 top-3 text-sm capitalize ${
            auction.status === 'active' ? 'bg-sage-500 text-white' :
            auction.status === 'ended' ? 'bg-stone-500 text-white' : 'bg-harvest-500 text-white'
          }`}>
            {auction.status === 'active' ? '🔴 LIVE' : auction.status}
          </Badge>
        </div>
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-foreground">{auction.title}</h2>
          <p className="text-muted-foreground">{auction.item_name}</p>

          {auction.status === 'upcoming' && (
            <div className="mt-4 rounded-xl border border-harvest-200 bg-harvest-50 p-4 text-sm text-harvest-700">
              This auction hasn&apos;t started yet. Check back when the coordinator goes live.
            </div>
          )}

          {auction.status === 'active' && !isDrawing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />Time Remaining
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">When the timer runs out, a winner is selected randomly from all paddle entries. More drops give you more entries.</TooltipContent>
                  </Tooltip>
                </span>
                <span className={`text-2xl font-mono font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-foreground'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <Progress value={timerPercent} className="h-2" />
            </div>
          )}

          {isDrawing && (
            <div className="mt-4 rounded-xl border border-sage-200 bg-sage-50 p-4 text-center">
              <p className="font-semibold text-green-900">Drawing winner…</p>
              <p className="mt-1 text-sm text-sage-700">Hang tight while we pick a paddle.</p>
            </div>
          )}

          {auction.status === 'ended' && auction.winning_paddle_id && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-harvest-50 p-4">
              <Trophy className="h-8 w-8 text-harvest-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-foreground">Auction Ended!</p>
                <p className="text-sm text-muted-foreground">
                  Winner: <span className="font-semibold text-harvest-700">Paddle #{auction.winning_paddle_id}</span>
                </p>
              </div>
            </div>
          )}

          {auction.status === 'ended' && !auction.winning_paddle_id && (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-muted-foreground">
              Auction ended with no drops — no winner was selected.
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl bg-canvas p-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-xs text-muted-foreground">Total Pot</p>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">The total value of all quarters dropped so far. The winner takes this prize.</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-lg font-bold text-harvest-600">{formatCents(totalPotCents)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Participants</p>
              <p className="text-lg font-bold">{leaderboard.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Drops</p>
              <p className="text-lg font-bold">{drops.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-harvest-500" />Drop Your Quarter
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Drop quarters from your wallet into the auction. More drops = more paddle entries = better odds of winning.</TooltipContent>
                </Tooltip>
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                Balance: <span className="font-semibold text-foreground">{formatCents(wallet?.balance ?? 0)}</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!paddleId ? (
              <div className="rounded-lg bg-harvest-50 p-4 text-center">
                <p className="text-sm text-harvest-700">Add funds to your wallet to get a Paddle ID and participate.</p>
                <Button className="mt-3" size="sm" onClick={() => { window.location.href = '/wallet' }}>
                  Top Up Wallet
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-sage-50 p-2">
                <span className="text-xs text-sage-700">Your Paddle:</span>
                <span className="font-mono font-bold text-sage-800">#{paddleId}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">Drop Amount</p>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">The minimum and maximum number of quarters you can drop in a single turn.</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {dropOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setDropAmount(amount)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                      dropAmount === amount ? 'border-harvest-500 bg-harvest-50 text-harvest-700' : 'border-stone-200 hover:border-harvest-400'
                    }`}
                  >
                    {formatCents(amount)}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleDrop}
              disabled={dropping || auction.status !== 'active' || !paddleId || (wallet?.balance ?? 0) < dropAmount || isDrawing}
              size="lg"
            >
              {dropping ? <span className="animate-pulse">Dropping…</span> : (
                <><Coins className="mr-2 h-5 w-5" />Drop {formatCents(dropAmount)}</>
              )}
            </Button>

            {myDrops.length > 0 && (
              <div className="rounded-lg bg-canvas p-3 text-center text-sm">
                <p className="text-muted-foreground">Your total in pot</p>
                <p className="text-lg font-bold text-foreground">{formatCents(myTotalCents)}</p>
                <p className="text-xs text-muted-foreground">{myDrops.length} drop{myDrops.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-harvest-500" />Live Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No drops yet — be the first!</div>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => {
                  const isMe = paddleId === entry.paddleId
                  return (
                    <div key={entry.paddleId} className={`flex items-center gap-3 rounded-lg p-2 ${isMe ? 'bg-harvest-50 ring-1 ring-harvest-400' : 'bg-canvas'}`}>
                      <span className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-harvest-500' : 'text-muted-foreground'}`}>
                        {i === 0 ? '👑' : `#${i + 1}`}
                      </span>
                      <span className="flex-1 font-mono text-sm">
                        Paddle #{entry.paddleId}
                        {isMe && <span className="ml-1 text-xs text-harvest-600">(you)</span>}
                      </span>
                      <div className="text-right">
                        <p className="text-xs font-semibold">{formatCents(entry.totalCents)}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.dropCount} drop{entry.dropCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
