'use client'

import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  buildEventCalendarPayload,
  openScheduleInCalendar,
} from '@/lib/shopper/calendar-export'
import type { Event } from '@/types/database'

type VendorCalendarEvent = Pick<
  Event,
  'id' | 'name' | 'description' | 'location_name' | 'address' | 'start_at' | 'end_at'
>

interface VendorAddToCalendarButtonProps {
  event: VendorCalendarEvent
}

export function VendorAddToCalendarButton({ event }: VendorAddToCalendarButtonProps) {
  if (!event.start_at || !event.end_at) return null

  const payload = buildEventCalendarPayload(event as Event)
  payload.title = `Vendor booth — ${event.name}`
  payload.description = [
    payload.description,
    'Your booth application was approved on Popup Hub.',
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-9 text-xs gap-1.5"
      onClick={() => openScheduleInCalendar(payload)}
    >
      <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
      Add to calendar
    </Button>
  )
}
