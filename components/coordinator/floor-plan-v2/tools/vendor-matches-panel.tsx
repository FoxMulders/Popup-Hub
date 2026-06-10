'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send, Sparkles, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { CategoryVendorMatchRow } from '@/lib/vendors/category-vendor-matches'

interface VendorMatchesPanelProps {
  eventId: string | null | undefined
  compact?: boolean
}

function formatCountdown(endsAt: string | null): string | null {
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Releasing to public soon'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `Public release in ${hours}h ${minutes}m`
}

function openBoothLabel(count: number): string {
  return count === 1 ? '1 open yellow booth' : `${count} open yellow booths`
}

function matchingVendorLabel(count: number): string {
  return count === 1 ? '1 matching vendor' : `${count} matching vendors`
}

function categoryCountLabel(count: number): string {
  return count === 1 ? '1 category' : `${count} categories`
}

export function VendorMatchesPanel({ eventId, compact }: VendorMatchesPanelProps) {
  const [matches, setMatches] = useState<CategoryVendorMatchRow[]>([])
  const [openBoothCount, setOpenBoothCount] = useState(0)
  const [venueVerified, setVenueVerified] = useState(true)
  const [priorityWindowEndsAt, setPriorityWindowEndsAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadMatches = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/coordinator/events/${eventId}/priority-invites`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load vendor matches')
      setMatches(data.matches ?? [])
      setOpenBoothCount(data.openBoothCount ?? 0)
      setVenueVerified(data.venueVerified !== false)
      setPriorityWindowEndsAt(data.priorityWindowEndsAt ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load vendor matches')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadMatches()
  }, [loadMatches])

  const totalVendors = matches.reduce((sum, row) => sum + row.vendors.length, 0)
  const countdown = formatCountdown(priorityWindowEndsAt)
  const canSendInvites =
    venueVerified && openBoothCount > 0 && totalVendors > 0 && !sending

  async function handleSendInvites() {
    if (!eventId) return
    setSending(true)
    try {
      const res = await fetch(`/api/coordinator/events/${eventId}/priority-invites`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invites')
      const inviteCount = Number(data.inviteCount) || 0
      toast.success(
        inviteCount === 1
          ? 'Priority invite sent to 1 vendor'
          : `Priority invites sent to ${inviteCount} vendors`
      )
      setConfirmOpen(false)
      await loadMatches()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invites')
    } finally {
      setSending(false)
    }
  }

  const inviteButton = (
    <Button
      type="button"
      size="sm"
      className={cn('shrink-0 gap-1.5', compact && 'h-8 text-[11px]')}
      disabled={!canSendInvites}
      onClick={() => setConfirmOpen(true)}
    >
      <Send className="h-3.5 w-3.5" />
      Send Priority Invites
    </Button>
  )

  if (!eventId) {
    return (
      <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
        Save the event to match vendors.
      </p>
    )
  }

  return (
    <div className={cn('min-w-[12rem] space-y-2', compact && 'space-y-1.5')}>
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold text-stone-800', compact ? 'text-[11px]' : 'text-xs')}>
            Vendor Matches
          </p>
          <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>
            {openBoothLabel(openBoothCount)} · {matchingVendorLabel(totalVendors)} (platform-wide)
          </p>
        </div>
      </div>

      {countdown ? (
        <p className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900">
          <Clock className="h-3 w-3" />
          {countdown}
        </p>
      ) : null}

      {!venueVerified ? (
        <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] text-amber-900">
          Verify the venue before sending priority invites.
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-4 text-center text-[10px] text-muted-foreground">
          Loading matches…
        </div>
      ) : matches.length === 0 ? (
        <div className="overflow-hidden rounded-lg border border-dashed border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-stone-50 px-3 py-3">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-white shadow-sm"
              aria-hidden
            >
              <Sparkles className="h-6 w-6 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold text-stone-900">No vendor matches yet</p>
              <p className="text-[10px] leading-snug text-stone-600">
                Draw vendor booths with categories on the canvas — platform matches appear here, then
                send 24-hour priority invites in one step.
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-auto">{inviteButton}</div>
          </div>
        </div>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[10px]">
          {matches.map((row) => (
            <li
              key={row.categoryId}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5"
            >
              <p className="font-semibold text-stone-800">
                {row.categoryName}{' '}
                <span className="font-normal text-muted-foreground">
                  ({row.openBoothCount === 1 ? '1 open' : `${row.openBoothCount} open`} ·{' '}
                  {row.vendors.length === 1 ? '1 vendor' : `${row.vendors.length} vendors`})
                </span>
              </p>
              {row.vendors.slice(0, 4).map((v) => (
                <p key={v.vendorId} className="truncate text-muted-foreground">
                  {v.businessName}
                </p>
              ))}
              {row.vendors.length > 4 ? (
                <p className="text-muted-foreground">+{row.vendors.length - 4} more</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {matches.length > 0 ? (
        <div className={cn(!compact && 'w-full')}>{inviteButton}</div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send 24-hour priority invites?</DialogTitle>
            <DialogDescription>
              Matching vendors get exclusive early access to claim and pay for open booths in their
              categories. Unclaimed spots automatically open on the public marketplace after 24
              hours.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {matchingVendorLabel(totalVendors)} across {categoryCountLabel(matches.length)} ·{' '}
            {openBoothLabel(openBoothCount)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSendInvites()} disabled={sending}>
              {sending ? 'Sending…' : 'Send invites'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
