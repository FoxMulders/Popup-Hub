'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { GripVertical, Loader2, Play, Square, Dices, Check, UserCheck, Trash2 } from 'lucide-react'
import type { AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'
import { statusLabel } from '@/lib/quarter-auction/state-machine'
import { formatCredits, DEFAULT_PADDLE_PURCHASE_CREDITS } from '@/lib/quarter-auction/credits'
import {
  AuctionStartCountdown,
  useAuctionCanStart,
} from '@/components/quarter-auction/auction-start-countdown'
import { cn } from '@/lib/utils'
import { AuctionClerkDesk } from '@/components/coordinator/auction-clerk-desk'

interface CoordinatorQuarterAuctionProps {
  eventId: string
  eventStartAt: string
  initialItems: AuctionCatalogItem[]
  initialSettings: QuarterAuctionSettings
}

interface VendorRow {
  vendor_id: string
  vendor?: { id: string; full_name: string; email: string }
}

export function CoordinatorQuarterAuction({
  eventId,
  eventStartAt,
  initialItems,
  initialSettings,
}: CoordinatorQuarterAuctionProps) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [settings, setSettings] = useState(initialSettings)
  const [settingsForm, setSettingsForm] = useState({
    paddle_purchase_credits: String(initialSettings.paddle_purchase_credits),
    default_entry_credits: String(initialSettings.default_entry_credits),
    paddle_pool_size: String(initialSettings.paddle_pool_size ?? 200),
    scheduled_start_at: initialSettings.scheduled_start_at
      ? initialSettings.scheduled_start_at.slice(0, 16)
      : eventStartAt.slice(0, 16),
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const canStartAuction = useAuctionCanStart(settings.scheduled_start_at, eventStartAt)
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [approvals, setApprovals] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [entryCount, setEntryCount] = useState(0)
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

  const removableQueued = useMemo(
    () => queuedItems.filter((i) => i.status === 'draft' || i.status === 'queued'),
    [queuedItems]
  )

  const loadVendors = useCallback(async () => {
    const res = await fetch(`/api/quarter-auction/${eventId}/vendors`)
    const json = await res.json()
    setVendors(json.approvedVendors ?? [])
    setApprovals(new Set((json.approvals ?? []).map((a: { vendor_id: string }) => a.vendor_id)))
  }, [eventId])

  useEffect(() => {
    if (!activeItem?.id) return
    const preset =
      activeItem.entry_cost_credits != null
        ? activeItem.entry_cost_credits
        : settings.default_entry_credits
    setEntryCost(String(preset))
  }, [activeItem?.id, activeItem?.entry_cost_credits, settings.default_entry_credits])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  useEffect(() => {
    if (!activeItem?.id) {
      setEntryCount(0)
      return
    }
    fetch(`/api/quarter-auction/items/${activeItem.id}/bid`)
      .then((r) => r.json())
      .then((json) => setEntryCount((json.entries ?? []).length))

    const channel = supabase
      .channel(`qa-entries-coord:${activeItem.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_item_entries',
          filter: `catalog_item_id=eq.${activeItem.id}`,
        },
        () => setEntryCount((c) => c + 1)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeItem?.id, supabase])

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setBusy('settings')
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paddle_purchase_credits: parseInt(settingsForm.paddle_purchase_credits, 10),
          default_entry_credits: parseInt(settingsForm.default_entry_credits, 10),
          paddle_pool_size: parseInt(settingsForm.paddle_pool_size, 10),
          scheduled_start_at: settingsForm.scheduled_start_at
            ? new Date(settingsForm.scheduled_start_at).toISOString()
            : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not save settings')
        return
      }
      setSettings(json.settings)
      toast.success('Auction settings saved')
    } finally {
      setBusy(null)
    }
  }

  async function approveAllVendors() {
    setBusy('approve-all')
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Bulk approve failed')
        return
      }
      await loadVendors()
      toast.success(`Approved ${json.count ?? 0} vendor(s) for the auction`)
    } finally {
      setBusy(null)
    }
  }

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
      toast.error('Enter a valid entry cost in quarters')
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

  async function removeItem(itemId: string) {
    setBusy(`remove:${itemId}`)
    try {
      const res = await fetch(`/api/quarter-auction/items/${itemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not remove item')
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
      toast.success('Item removed')
    } finally {
      setBusy(null)
    }
  }

  async function removeSelected(clearAll = false) {
    setBusy(clearAll ? 'clear-all' : 'remove-selected')
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          clearAll
            ? { clear_all: true }
            : { item_ids: Array.from(selectedIds) }
        ),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not remove items')
        return
      }
      const removed = new Set((json.ids ?? []) as string[])
      setItems((prev) => prev.filter((i) => !removed.has(i.id)))
      setSelectedIds(new Set())
      toast.success(`Removed ${json.removed ?? 0} item(s)`)
    } finally {
      setBusy(null)
    }
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <AuctionStartCountdown
        scheduledStartAt={settings.scheduled_start_at}
        eventStartAt={eventStartAt}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Auction settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="paddle-cost">Paddle purchase (quarters)</Label>
              <Input
                id="paddle-cost"
                type="number"
                min={1}
                value={settingsForm.paddle_purchase_credits}
                onChange={(e) =>
                  setSettingsForm((s) => ({ ...s, paddle_purchase_credits: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Default: {formatCredits(DEFAULT_PADDLE_PURCHASE_CREDITS)} per paddle
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="default-entry">Default starting amount (optional)</Label>
              <Input
                id="default-entry"
                type="number"
                min={1}
                value={settingsForm.default_entry_credits}
                onChange={(e) =>
                  setSettingsForm((s) => ({ ...s, default_entry_credits: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Placeholder until each vendor&apos;s price is entered live. Most nights this changes
                item by item when they&apos;re on stage.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="scheduled-start">Advertised auction start</Label>
              <Input
                id="scheduled-start"
                type="datetime-local"
                value={settingsForm.scheduled_start_at}
                onChange={(e) =>
                  setSettingsForm((s) => ({ ...s, scheduled_start_at: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Catalog items cannot activate or open bidding before this time.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="paddle-pool">Paddle number pool (1–200)</Label>
              <Input
                id="paddle-pool"
                type="number"
                min={1}
                max={200}
                value={settingsForm.paddle_pool_size}
                onChange={(e) =>
                  setSettingsForm((s) => ({ ...s, paddle_pool_size: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                White chips 1–100, green chips 101–200. Patrons pick numbers at registration; taken only after
                payment.
              </p>
            </div>
            <Button type="submit" disabled={busy === 'settings'} className="sm:col-span-2">
              {busy === 'settings' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AuctionClerkDesk eventId={eventId} settings={settings} liveItem={activeItem} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">Vendor approvals</CardTitle>
          {vendors.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === 'approve-all'}
              onClick={approveAllVendors}
            >
              Approve all booth vendors
            </Button>
          )}
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
                  {entryCount > 0 && (
                    <> · {entryCount} paddle{entryCount === 1 ? '' : 's'} in draw pool</>
                  )}
                </p>
                {activeItem.entry_cost_credits != null && (
                  <p className="text-sm">
                    Item entry: {formatCredits(activeItem.entry_cost_credits)} per paddle
                  </p>
                )}
              </div>
            </div>

            {activeItem.status === 'active_price_setting' && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-forest">Vendor on stage — enter bid amount</p>
                  <p className="text-xs text-muted-foreground">
                    The vendor announces quarters per paddle. Type what you hear, then open bidding.
                    {activeItem.entry_cost_credits != null ? (
                      <>
                        {' '}
                        Vendor suggested{' '}
                        {formatCredits(activeItem.entry_cost_credits)} — adjust if they announce
                        something different.
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="entry-cost">Quarters per paddle</Label>
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
                    disabled={!!busy || !canStartAuction}
                    onClick={async () => {
                      const credits = parseInt(entryCost, 10) || settings.default_entry_credits
                      await setItemEntryCost(activeItem.id)
                      await itemAction(activeItem.id, 'transition', { to_status: 'bidding_open' })
                    }}
                  >
                    <Play className="h-4 w-4" />
                    Start bidding
                  </Button>
                  {!canStartAuction && (
                    <p className="w-full text-xs text-harvest-800">
                      Waiting for advertised start time before bidding can open.
                    </p>
                  )}
                </div>
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
                className="gap-1.5 bg-harvest-600 hover:bg-harvest-700"
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Catalog queue</CardTitle>
            <p className="text-sm text-muted-foreground">Drag to reorder. Approve drafts to queue them.</p>
          </div>
          {removableQueued.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-600"
                  disabled={!!busy}
                  onClick={() => removeSelected(false)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove selected ({selectedIds.size})
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-600"
                disabled={!!busy}
                onClick={() => removeSelected(true)}
              >
                <Trash2 className="h-4 w-4" />
                Clear queue
              </Button>
            </div>
          )}
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
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-stone-300"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`Select ${item.title} for removal`}
                />
                {item.status === 'queued' && (
                  <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {item.image_url && (
                  <Image
                    src={item.image_url}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded object-contain bg-canvas"
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
                    disabled={!!busy || !canStartAuction}
                    onClick={() =>
                      itemAction(item.id, 'transition', {
                        to_status: 'active_price_setting',
                        ...(item.entry_cost_credits != null
                          ? { entry_cost_credits: item.entry_cost_credits }
                          : {}),
                      })
                    }
                  >
                    Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={!!busy}
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.title}`}
                >
                  {busy === `remove:${item.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Paddles: {formatCredits(settings.paddle_purchase_credits ?? DEFAULT_PADDLE_PURCHASE_CREDITS)} each ·
        Pool: {settings.paddle_pool_size ?? 200} numbers · Bid amount is set per item when the vendor is
        on stage (or optionally when they submit their item).
      </p>
    </div>
  )
}
