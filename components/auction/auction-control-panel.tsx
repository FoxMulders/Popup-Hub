'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { buildLeaderboard } from '@/lib/auction/winner'
import { formatCents } from '@/lib/square/client'
import { cn } from '@/lib/utils'
import type { Auction, AuctionDrop } from '@/types/database'
import { Gavel, Play, Square, Loader2, ExternalLink, Trash2 } from 'lucide-react'

interface AuctionControlPanelProps {
  auction: Auction
  eventId: string
}

export function AuctionControlPanel({ auction: initialAuction }: AuctionControlPanelProps) {
  const supabase = createClient()
  const [auction, setAuction] = useState(initialAuction)
  const [drops, setDrops] = useState<AuctionDrop[]>(initialAuction.drops ?? [])
  const [busy, setBusy] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  const leaderboard = buildLeaderboard(drops)
  const totalPotCents = drops.reduce((sum, d) => sum + d.amount, 0)

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
      .channel(`coord-drops:${auction.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_drops', filter: `auction_id=eq.${auction.id}` },
        (payload) => setDrops((prev) => [...prev, payload.new as AuctionDrop])
      )
      .subscribe()

    const auctionChannel = supabase
      .channel(`coord-auction:${auction.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auction.id}` },
        (payload) => setAuction((prev) => ({ ...prev, ...(payload.new as Auction) }))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(dropsChannel)
      supabase.removeChannel(auctionChannel)
    }
  }, [auction.id, supabase])

  async function callAction(action: 'start' | 'end' | 'cancel') {
    setBusy(action)
    try {
      const res = await fetch(`/api/auction/${auction.id}/${action}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `Failed to ${action} auction`)
        return
      }
      if (action === 'start') toast.success('Auction is live!')
      if (action === 'end') toast.success('Auction ended — winner selected')
      if (action === 'cancel') toast.success('Auction cancelled')
    } finally {
      setBusy(null)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gavel className="h-5 w-5 text-harvest-600" />
              {auction.title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{auction.item_name}</p>
          </div>
          <Badge
            className={`capitalize ${
              auction.status === 'active'
                ? 'bg-green-500 text-white'
                : auction.status === 'ended'
                  ? 'bg-gray-500 text-white'
                  : auction.status === 'cancelled'
                    ? 'bg-red-400 text-white'
                    : 'bg-amber-500 text-white'
            }`}
          >
            {auction.status === 'active' ? 'LIVE' : auction.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-center text-sm">
          <div>
            <p className="text-xs text-gray-500">Pot</p>
            <p className="font-bold text-amber-600">{formatCents(totalPotCents)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Participants</p>
            <p className="font-bold">{leaderboard.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Drops</p>
            <p className="font-bold">{drops.length}</p>
          </div>
        </div>

        {auction.status === 'active' && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center">
            <p className="text-xs text-green-700">Time remaining</p>
            <p className="font-mono text-2xl font-bold text-green-900">
              {timeLeft > 0 ? formatTime(timeLeft) : 'Drawing…'}
            </p>
          </div>
        )}

        {auction.status === 'ended' && auction.winning_paddle_id && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <p className="font-semibold text-amber-900">Winner: Paddle #{auction.winning_paddle_id}</p>
          </div>
        )}

        {auction.status === 'ended' && !auction.winning_paddle_id && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-gray-600">
            No drops — no winner selected.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {auction.status === 'upcoming' && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => callAction('start')}
                disabled={busy !== null}
              >
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start auction
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-600"
                onClick={() => callAction('cancel')}
                disabled={busy !== null}
              >
                {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Cancel
              </Button>
            </>
          )}
          {auction.status === 'active' && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => callAction('end')}
              disabled={busy !== null}
            >
              {busy === 'end' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              End early
            </Button>
          )}
          <Link
            href={`/auctions/${auction.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5 inline-flex')}
          >
            <ExternalLink className="h-4 w-4" />
            Participant view
          </Link>
        </div>

        {drops.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs">
            {drops.slice(-20).reverse().map((d) => (
              <div key={d.id} className="flex justify-between font-mono text-gray-600">
                <span>Paddle #{d.paddle_id}</span>
                <span>{formatCents(d.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {auction.status === 'upcoming' && (
          <p className="text-xs text-muted-foreground">
            Only one auction can be active per event at a time.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface AuctionListProps {
  auctions: Auction[]
  eventId: string
}

export function AuctionList({ auctions, eventId }: AuctionListProps) {
  if (auctions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center">
        <Gavel className="mx-auto h-8 w-8 text-stone-300" />
        <p className="mt-2 text-sm text-muted-foreground">No quarter auctions yet for this event.</p>
        <Link
          href={`/coordinator/auctions/new?eventId=${eventId}`}
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 inline-flex mt-4')}
        >
          <Gavel className="h-4 w-4" />
          Create auction
        </Link>
      </div>
    )
  }

  const sorted = [...auctions].sort((a, b) => {
    const order = { active: 0, upcoming: 1, ended: 2, cancelled: 3 }
    const ao = order[a.status as keyof typeof order] ?? 4
    const bo = order[b.status as keyof typeof order] ?? 4
    if (ao !== bo) return ao - bo
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/coordinator/auctions/new?eventId=${eventId}`}
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5 inline-flex')}
        >
          <Gavel className="h-4 w-4" />
          New auction
        </Link>
      </div>
      {sorted.map((auction) => (
        <AuctionControlPanel key={auction.id} auction={auction} eventId={eventId} />
      ))}
    </div>
  )
}
