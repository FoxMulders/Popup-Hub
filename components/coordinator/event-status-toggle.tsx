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
  const transitions = TRANSITIONS[currentStatus]

  async function changeStatus(newStatus: EventStatus) {
    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', event.id)

    if (error) {
      toast.error('Failed to update event status.')
    } else {
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
        <Badge className={`capitalize text-sm border ${STATUS_BADGE[currentStatus]}`}>
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
