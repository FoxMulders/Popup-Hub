'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ChevronDown, Eye, Globe, Zap, CheckCircle, XCircle } from 'lucide-react'
import type { Event, EventStatus } from '@/types/database'

const TRANSITIONS: Record<EventStatus, { label: string; status: EventStatus; icon: React.ReactNode }[]> = {
  draft: [
    { label: 'Publish Event', status: 'published', icon: <Globe className="h-4 w-4" /> },
  ],
  published: [
    { label: 'Mark as Active', status: 'active', icon: <Zap className="h-4 w-4" /> },
    { label: 'Return to Draft', status: 'draft', icon: <Eye className="h-4 w-4" /> },
    { label: 'Cancel Event', status: 'cancelled', icon: <XCircle className="h-4 w-4" /> },
  ],
  active: [
    { label: 'Mark Completed', status: 'completed', icon: <CheckCircle className="h-4 w-4" /> },
    { label: 'Cancel Event', status: 'cancelled', icon: <XCircle className="h-4 w-4" /> },
  ],
  completed: [],
  cancelled: [],
}

const STATUS_BADGE: Record<EventStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-600',
}

interface EventStatusToggleProps {
  event: Event
}

export function EventStatusToggle({ event }: EventStatusToggleProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
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
      toast.success(`Event is now ${newStatus}.`)
      startTransition(() => router.refresh())
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={`capitalize text-sm ${STATUS_BADGE[currentStatus]}`}>
        {currentStatus}
      </Badge>
      {transitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            disabled={isPending}
          >
            Change Status
            <ChevronDown className="ml-1 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {transitions.map(({ label, status, icon }) => (
              <DropdownMenuItem
                key={status}
                onClick={() => changeStatus(status)}
                className="gap-2"
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
