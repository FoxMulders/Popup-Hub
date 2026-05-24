'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { GripVertical, Loader2, Play, Square, Dices, Check, UserCheck } from 'lucide-react'
import type { AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'
import { statusLabel } from '@/lib/quarter-auction/state-machine'
import { formatCredits } from '@/lib/quarter-auction/credits'
import { cn } from '@/lib/utils'

interface CoordinatorQuarterAuctionProps {
  eventId: string
  initialItems: AuctionCatalogItem[]
  initialSettings: QuarterAuctionSettings
}

interface VendorRow {
  vendor_id: string
  vendor?: { id: string; full_name: string; email: string }
}

export function CoordinatorQuarterAuction({
  eventId,
  initialItems,
  initialSettings,
}: CoordinatorQuarterAuctionProps) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [settings] = useState(initialSettings)
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [approvals, setApprovals] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [entryCost, setEntryCost] = useState<string>(
    String(initialSettings.default_entry_credits)
  )

  const activeItem =
    items.find((i) =>
      ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'].includes(i.status)
    ) ?? null

  const lastCompleted = [...items]
    .filter((i) => i.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]

  const queuedItems = items
    .filter((i) => i.status === 'queued' || i.status === 'draft')
    .sort((a, b) => a.queue_position - b.queue_position)

  const loadVendors = useCallback(async () => {
    const res = await fetch(`/api/quarter-auction/${eventId}/vendors`)
    const json = await res.json()
    setVendors(json.approvedVendors ?? [])
    setApprovals(new Set((json.approvals ?? []).map((a: { vendor_id: string }) => a.vendor_id)))
  }, [eventId])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  useEffect(() => {
    const channel = supabase
      .channel(`qa-coord:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_catalog_items', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as AuctionCatalogItem
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === row.id)
            if (idx === -1) {
              return [...prev, row].sort((a, b) => a.queue_position - b.queue_position)
            }
            const next = [...prev]
            next[idx] = { ...next[idx], ...row }
            return next.sort((a, b) => a.queue_position - b.queue_position)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, supabase])

  async function itemAction(itemId: string, action: string, extra?: Record<string, unknown>) {
    setBusy(`${action}:${itemId}`)
    try {
      const res = await fetch(`/api/quarter-auction/items/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Action failed')
        return
      }
      if (json.item) {
        setItems((prev) => prev.map((i) => (i.id === json.item.id ? json.item : i)))
      }
    } finally {
      setBusy(null)
    }
  }

  async function setItemEntryCost(itemId: string) {
    const credits = parseInt(entryCost, 10)
    if (!credits || credits < 1) {
      toast.error('Enter a valid entry cost in credits')
      return
    }
    setBusy(`cost:${itemId}`)
    try {
      const res = await fetch(`/api/quarter-auction/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_cost_credits: credits }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to set cost')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === json.item.id ? json.item : i)))
    } finally {
      setBusy(null)
    }
  }

  async function toggleVendor(vendorId: string, approved: boolean) {
    setBusy(`vendor:${vendorId}`)
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, approved }),
      })
      if (!res.ok) {
        toast.error('Could not update vendor approval')
        return
      }
      setApprovals((prev) => {
        const next = new Set(prev)
        if (approved) next.add(vendorId)
        else next.delete(vendorId)
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  async function saveReorder(ordered: AuctionCatalogItem[]) {
    const orderedIds = ordered.map((i) => i.id)
    await fetch(`/api/quarter-auction/${eventId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
    setItems((prev) => {
      const map = new Map(ordered.map((i, idx) => [i.id, idx]))
      return [...prev].sort(
        (a, b) => (map.get(a.id) ?? a.queue_position) - (map.get(b.id) ?? b.queue_position)
      )
    })
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return
    const reorderable = [...queuedItems]
    const fromIdx = reorderable.findIndex((i) => i.id === dragId)
    const toIdx = reorderable.findIndex((i) => i.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = reorderable.splice(fromIdx, 1)
    reorderable.splice(toIdx, 0, moved)
    saveReorder(reorderable)
    setDragId(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendor approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved booth vendors yet.</p>
          ) : (
            vendors.map((row) => {
              const id = row.vendor_id
              const name = row.vendor?.full_name ?? 'Vendor'
              const isApproved = approvals.has(id)
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{name}</p>
                    <p className="text-xs text-muted-foreground">{row.vendor?.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isApproved ? 'secondary' : 'default'}
                    disabled={busy === `vendor:${id}`}
                    onClick={() => toggleVendor(id, !isApproved)}
                    className="gap-1.5"
                  >
                    {busy === `vendor:${id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isApproved ? (
                      <>
                        <Check className="h-4 w-4" /> Approved
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" /> Approve for auction
                      </>
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {activeItem && (
        <Card className="border-forest/30 bg-forest/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Live item
              <Badge>{statusLabel(activeItem.status)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              {activeItem.image_url && (
                <Image
                  src={activeItem.image_url}
                  alt={activeItem.title}
                  width={80}
                  height={80}
                  className="rounded-lg object-contain bg-white"
                />
              )}
              <div>
                <p className="font-semibold">{activeItem.title}</p>
                <p className="text-sm text-muted-foreground">
                  Pool: {formatCredits(activeItem.pool_credits)}
                </p>
                {activeItem.entry_cost_credits != null && (
                  <p className="text-sm">
                    Entry: {formatCredits(activeItem.entry_cost_credits)} per paddle
                  </p>
                )}
              </div>
            </div>

            {activeItem.status === 'active_price_setting' && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="entry-cost">Entry cost (credits per paddle)</Label>
                  <Input
                    id="entry-cost"
                    type="number"
                    min={1}
                    value={entryCost}
                    onChange={(e) => setEntryCost(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button
                  onClick={() => setItemEntryCost(activeItem.id)}
                  disabled={busy === `cost:${activeItem.id}`}
                >
                  Save entry cost
                </Button>
                <Button
                  className="gap-1.5"
                  disabled={!!busy}
                  onClick={async () => {
                    const credits = parseInt(entryCost, 10) || settings.default_entry_credits
                    await setItemEntryCost(activeItem.id)
                    await itemAction(activeItem.id, 'transition', { to_status: 'bidding_open' })
                  }}
                >
                  <Play className="h-4 w-4" />
                  Start bidding
                </Button>
              </div>
            )}

            {activeItem.status === 'bidding_open' && (
              <Button
                variant="destructive"
                className="gap-1.5"
                disabled={!!busy}
                onClick={() => itemAction(activeItem.id, 'transition', { to_status: 'bidding_closed' })}
              >
                <Square className="h-4 w-4" />
                Close bidding &amp; freeze
              </Button>
            )}

            {activeItem.status === 'bidding_closed' && (
              <Button
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                disabled={!!busy}
                onClick={() => itemAction(activeItem.id, 'draw')}
              >
                <Dices className="h-4 w-4" />
                Roll draw
              </Button>
            )}

            {activeItem.status === 'completed' && activeItem.winning_paddle_number && (
              <p className="text-lg font-bold text-forest" role="status">
                Winner: Paddle #{activeItem.winning_paddle_number}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {lastCompleted && !activeItem && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Last completed</p>
            <p className="font-semibold">{lastCompleted.title}</p>
            {lastCompleted.winning_paddle_number && (
              <p className="text-forest font-mono font-bold">
                Winner: #{lastCompleted.winning_paddle_number} · Pool{' '}
                {formatCredits(lastCompleted.pool_credits)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Catalog queue</CardTitle>
          <p className="text-sm text-muted-foreground">Drag to reorder. Approve drafts to queue them.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {queuedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queued items yet.</p>
          ) : (
            queuedItems.map((item) => (
              <div
                key={item.id}
                draggable={item.status === 'queued'}
                onDragStart={() => setDragId(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-white p-3',
                  dragId === item.id && 'opacity-50'
                )}
              >
                {item.status === 'queued' && (
                  <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {item.image_url && (
                  <Image
                    src={item.image_url}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded object-contain bg-slate-50"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {statusLabel(item.status)}
                  </Badge>
                </div>
                {item.status === 'draft' && (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => itemAction(item.id, 'approve')}
                  >
                    Approve
                  </Button>
                )}
                {item.status === 'queued' && !activeItem && (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() =>
                      itemAction(item.id, 'transition', {
                        to_status: 'active_price_setting',
                        entry_cost_credits: settings.default_entry_credits,
                      })
                    }
                  >
                    Activate
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Paddle purchase: {formatCredits(settings.paddle_purchase_credits)} each · Default entry:{' '}
        {formatCredits(settings.default_entry_credits)}
      </p>
    </div>
  )
}
