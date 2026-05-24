'use client'

import Link from 'next/link'
import { X, MapPin, Calendar, Clock } from 'lucide-react'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Event } from '@/types/database'
import { format } from 'date-fns'

interface EventMapPopoverProps {
  event: Event
  onClose: () => void
}

export default function EventMapPopover({ event, onClose }: EventMapPopoverProps) {
  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card rounded-xl shadow-2xl border p-4 z-10">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{event.name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location_name}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {event.cover_image_url && (
        <div className="mt-3 h-32 overflow-hidden rounded-lg">
          <ExpandableImage
            src={event.cover_image_url}
            alt={event.name}
            className="h-full w-full object-contain bg-canvas"
            containerClassName="h-full"
          />
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{format(new Date(event.start_at), 'EEE, MMM d, yyyy')}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>
            {format(new Date(event.start_at), 'h:mm a')} –{' '}
            {format(new Date(event.end_at), 'h:mm a')}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Badge variant={event.booking_mode === 'instant' ? 'default' : 'secondary'} className="text-xs">
          {event.booking_mode === 'instant' ? 'Instant Book' : 'Juried'}
        </Badge>
        <Link href={`/events/${event.id}`}>
          <Button size="sm" className="h-7 text-xs">View event</Button>
        </Link>
      </div>
    </div>
  )
}
