'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send, Users, Clock } from 'lucide-react'
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

  async function handleSendInvites() {
    if (!eventId) return
    setSending(true)
    try {
      const res = await fetch(`/api/coordinator/events/${eventId}/priority-invites`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invites')
      toast.success(`Priority invites sent to ${data.inviteCount} vendor${data.inviteCount === 1 ? '' : 's'}`)
      setConfirmOpen(false)
      await loadMatches()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invites')
    } finally {
      setSending(false)
    }
  }

  if (!eventId) {
    return (
      <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
        Save the event to match vendors.
      </p>
    )
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <div className="flex items-start gap-2">
        <Users className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold text-stone-800', compact ? 'text-[11px]' : 'text-xs')}>
            Vendor Matches
          </p>
          <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>
            {openBoothCount} open yellow booth{openBoothCount === 1 ? '' : 's'} · {totalVendors} matching vendor
            {totalVendors === 1 ? '' : 's'} (platform-wide)
          </p>
        </div>
      </div>

      {countdown ? (
        <p className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900">
          <Clock className="h-3 w-3" />
          {countdown}
        </p>
      ) : null}

      {!venueVerified ? (
        <p className="text-[10px] text-amber-800 bg-amber-50 rounded-md px-2 py-1.5">
          Verify the venue before sending priority invites.
        </p>
      ) : null}

      {loading ? (
        <p className="text-[10px] text-muted-foreground">Loading matches…</p>
      ) : matches.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Draw vendor booths with categories to see matches.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[10px]">
          {matches.map((row) => (
            <li key={row.categoryId} className="rounded-md border border-stone-200 bg-white px-2 py-1.5">
              <p className="font-semibold text-stone-800">
                {row.categoryName}{' '}
                <span className="font-normal text-muted-foreground">
                  ({row.openBoothCount} open · {row.vendors.length} vendors)
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

      <Button
        type="button"
        size="sm"
        className={cn('w-full gap-1.5', compact && 'h-8 text-[11px]')}
        disabled={!venueVerified || openBoothCount === 0 || totalVendors === 0 || sending}
        onClick={() => setConfirmOpen(true)}
      >
        <Send className="h-3.5 w-3.5" />
        Send Priority Invites
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send 24-hour priority invites?</DialogTitle>
            <DialogDescription>
              Matching vendors get exclusive early access to claim and pay for open booths in their
              categories. Unclaimed spots automatically open on the public marketplace after 24 hours.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {totalVendors} vendor{totalVendors === 1 ? '' : 's'} across {matches.length} categor
            {matches.length === 1 ? 'y' : 'ies'} · {openBoothCount} open booth
            {openBoothCount === 1 ? '' : 's'}
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
