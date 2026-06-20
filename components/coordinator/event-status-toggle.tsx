'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CancelEventDialog } from '@/components/coordinator/cancel-event-dialog'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { checkCoordinatorPublishGate } from '@/lib/coordinator/publish-gate-client'
import { toast } from 'sonner'
import { ChevronDown, Eye, Globe, Zap, CheckCircle, XCircle } from 'lucide-react'
import type { Event, EventStatus } from '@/types/database'

const TRANSITIONS: Record<
  EventStatus,
  { label: string; status: EventStatus; icon: React.ReactNode; destructive?: boolean }[]
> = {
  draft: [
    { label: 'Publish Event', status: 'published', icon: <Globe className="h-4 w-4" /> },
  ],
  published: [
    { label: 'Mark as Active', status: 'active', icon: <Zap className="h-4 w-4" /> },
    { label: 'Return to Draft', status: 'draft', icon: <Eye className="h-4 w-4" /> },
    { label: 'Cancel Event', status: 'cancelled', icon: <XCircle className="h-4 w-4" />, destructive: true },
  ],
  active: [
    { label: 'Mark Completed', status: 'completed', icon: <CheckCircle className="h-4 w-4" /> },
    { label: 'Cancel Event', status: 'cancelled', icon: <XCircle className="h-4 w-4" />, destructive: true },
  ],
  completed: [],
  cancelled: [],
}

const STATUS_BADGE: Record<EventStatus, string> = {
  draft: 'bg-canvas text-muted-foreground border-stone-200',
  published: 'bg-harvest-100 text-harvest-800 border-harvest-200',
  active: 'bg-sage-100 text-sage-800 border-sage-200',
  completed: 'bg-stone-100 text-muted-foreground border-stone-200',
  cancelled: 'bg-terracotta-50 text-terracotta-800 border-terracotta-200',
}

interface EventStatusToggleProps {
  event: Event
}

export function EventStatusToggle({ event }: EventStatusToggleProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [cancelOpen, setCancelOpen] = useState(false)
  const currentStatus = event.status as EventStatus
  const transitions = TRANSITIONS[currentStatus] ?? []
  const statusBadgeClass = STATUS_BADGE[currentStatus] ?? STATUS_BADGE.draft

  async function changeStatus(newStatus: EventStatus) {
    /*
     * Mandatory booth-fee disclosure gate. Before flipping into a
     * Published state from any path (this status dropdown OR the
     * form's "Publish" button), we make sure every booth category has
     * an explicit fee value. The form already enforces this on
     * publish — we re-check here because vendors who arrive at the
     * registration card need to see a price line, and a Draft event
     * can have empty/half-set categories from the wizard.
     */
    if (newStatus === 'published' || newStatus === 'active') {
      const publishBlock = await checkCoordinatorPublishGate()
      if (publishBlock) {
        toast.error(publishBlock)
        return
      }
    }

    if (newStatus === 'published') {
      const { data: eventRow, error: venueLoadError } = await supabase
        .from('events')
        .select(
          'latitude, longitude, address, location_name, venue_verified, venue_verification_status, venue_verification_reason'
        )
        .eq('id', event.id)
        .single()

      if (venueLoadError) {
        toast.error('Could not verify venue before publishing.')
        return
      }

      if (!eventRow?.venue_verified && eventRow?.venue_verification_status !== 'manual_override') {
        const verifyRes = await fetch('/api/coordinator/venues/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            latitude: eventRow.latitude,
            longitude: eventRow.longitude,
            address: eventRow.address,
            locationName: eventRow.location_name,
            pinDropped: true,
            persist: true,
          }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData.verified) {
          toast.error(
            verifyData.reason ??
              'Venue must be verified on the map with a complete address before publishing.'
          )
          return
        }
      }

      const { data: limits, error: feeError } = await supabase
        .from('event_category_limits')
        .select('price_per_booth, category:categories(name)')
        .eq('event_id', event.id)

      if (feeError) {
        toast.error('Could not verify booth fees before publishing.')
        return
      }

      type FeeRow = {
        price_per_booth: number | null
        category: { name?: string | null } | { name?: string | null }[] | null
      }

      const rows = (limits ?? []) as FeeRow[]
      if (rows.length === 0) {
        toast.error(
          'Add at least one booth category and state its fee before publishing.'
        )
        return
      }
      const missing = rows.find(
        (row) =>
          row.price_per_booth === null ||
          row.price_per_booth === undefined ||
          !Number.isFinite(row.price_per_booth) ||
          row.price_per_booth < 0
      )
      if (missing) {
        const cat = Array.isArray(missing.category)
          ? missing.category[0]
          : missing.category
        const catName = cat?.name ?? 'one of your categories'
        toast.error(
          `Set a booth fee for ${catName} before publishing. Use $0 for free booths.`
        )
        return
      }
    }

    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', event.id)

    if (error) {
      toast.error('Failed to update event status.')
    } else {
      if (newStatus === 'published') {
        void fetch(`/api/coordinator/events/${event.id}/trust-sync`, { method: 'POST' }).catch(
          () => {
            /* trust sync is best-effort */
          }
        )
      }
      await revalidateMarketsCacheClient()
      toast.success(`Event is now ${newStatus}.`)
      startTransition(() => router.refresh())
    }
  }

  function handleTransition(status: EventStatus, destructive?: boolean) {
    if (destructive && status === 'cancelled') {
      setCancelOpen(true)
      return
    }
    void changeStatus(status)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge className={`capitalize text-sm border ${statusBadgeClass}`}>
          {currentStatus}
        </Badge>
        {transitions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 border-stone-200 bg-card px-4 py-2 text-sm font-medium shadow-[var(--shadow-market)] transition-all duration-200 hover:bg-canvas hover:scale-[1.02] active:translate-y-0.5 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              disabled={isPending}
            >
              Change Status
              <ChevronDown className="ml-1 h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {transitions.map(({ label, status, icon, destructive }, i) => (
                <div key={status}>
                  {destructive && i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => handleTransition(status, destructive)}
                    className={`gap-2 min-h-11 ${destructive ? 'text-terracotta-700 focus:text-terracotta-800 focus:bg-terracotta-50' : ''}`}
                  >
                    {icon}
                    {label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <CancelEventDialog
        eventId={event.id}
        eventName={event.name}
        eventStartAt={event.start_at}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  )
}
