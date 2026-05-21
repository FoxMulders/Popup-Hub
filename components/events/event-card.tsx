import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import type { Event } from '@/types/database'

interface EventCardProps {
  event: Event
  href: string
  actions?: React.ReactNode
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  published: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-600',
}

export function EventCard({ event, href, actions }: EventCardProps) {
  return (
    <Link href={href}>
      <Card className="group h-full cursor-pointer overflow-hidden transition hover:shadow-md">
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-12 w-12 text-amber-300" />
            </div>
          )}
          <Badge className={`absolute right-2 top-2 capitalize text-xs ${STATUS_BADGE[event.status]}`}>
            {event.status}
          </Badge>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 leading-tight line-clamp-1">{event.name}</h3>
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <span className="truncate">{event.location_name}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'h:mm a')} –{' '}
              {format(new Date(event.end_at), 'h:mm a')}
            </p>
          </div>
          <Badge
            variant="outline"
            className="mt-3 capitalize text-xs"
          >
            {event.booking_mode === 'instant' ? '⚡ Instant Book' : '🔍 Juried Approval'}
          </Badge>
          {actions && <div className="mt-3" onClick={(e) => e.preventDefault()}>{actions}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}
