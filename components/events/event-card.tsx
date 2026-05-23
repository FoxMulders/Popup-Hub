import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import { marketStatusBadge } from '@/lib/theme/market'
import type { Event } from '@/types/database'

interface EventCardProps {
  event: Event
  href: string
  actions?: React.ReactNode
  hoursLabel?: string
  distanceLabel?: string
  vendorCount?: number
  /** Vendor-only: show booking mode / pricing tier badge. Hidden for shopper discovery. */
  showBookingMode?: boolean
}

const STATUS_BADGE: Record<string, string> = {
  active: marketStatusBadge.success,
  published: marketStatusBadge.warning,
  draft: marketStatusBadge.neutral,
  completed: marketStatusBadge.neutral,
  cancelled: marketStatusBadge.error,
}

export function EventCard({
  event,
  href,
  actions,
  hoursLabel,
  distanceLabel,
  vendorCount,
  showBookingMode = false,
}: EventCardProps) {
  const hours =
    hoursLabel ??
    `${format(new Date(event.start_at), 'h:mm a')} – ${format(new Date(event.end_at), 'h:mm a')}`

  return (
    <Link href={href}>
      <Card className="group h-full cursor-pointer overflow-hidden transition hover:shadow-[var(--shadow-market-md)]">
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-harvest-100 to-sage-100">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-12 w-12 text-harvest-300" />
            </div>
          )}
          <Badge
            className={`absolute right-2 top-2 border capitalize text-xs ${STATUS_BADGE[event.status]}`}
          >
            {event.status}
          </Badge>
          {distanceLabel ? (
            <Badge className="absolute left-2 top-2 border bg-white/90 text-[10px] text-foreground">
              {distanceLabel}
            </Badge>
          ) : null}
        </div>
        <CardContent className="p-4">
          <h3 className="line-clamp-1 font-heading font-semibold leading-tight text-foreground">
            {event.name}
          </h3>
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-harvest-500" />
              <span className="truncate">{event.location_name}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-harvest-500" />
              {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0 text-harvest-500" />
              {hours}
            </p>
            {vendorCount != null && vendorCount > 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 text-harvest-500" />
                {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} confirmed
              </p>
            ) : null}
          </div>
          {showBookingMode ? (
            <Badge variant="outline" className="mt-3 capitalize text-xs">
              {event.booking_mode === 'instant' ? '⚡ Instant Book' : '🔍 Juried Approval'}
            </Badge>
          ) : null}
          {actions ? (
            <div className="mt-3" onClick={(e) => e.preventDefault()}>
              {actions}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
