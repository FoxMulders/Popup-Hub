import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import { marketStatusBadge } from '@/lib/theme/market'
import type { Event } from '@/types/database'
import type { EventDisplayStatus } from '@/lib/queries/events'

interface EventCardProps {
  event: Event
  href: string
  actions?: React.ReactNode
  hoursLabel?: string
  distanceLabel?: string
  vendorCount?: number
  /** e.g. "8 of 20 spots left" */
  capacityLabel?: string | null
  /** Override badge when UI treats past markets as archived. */
  displayStatus?: EventDisplayStatus
  /** Vendor-only: show booking mode / pricing tier badge. Hidden for shopper discovery. */
  showBookingMode?: boolean
}

const STATUS_BADGE: Record<string, string> = {
  active: marketStatusBadge.success,
  published: marketStatusBadge.warning,
  draft: marketStatusBadge.neutral,
  completed: marketStatusBadge.neutral,
  cancelled: marketStatusBadge.error,
  archived: marketStatusBadge.neutral,
  full: marketStatusBadge.error,
}

const STATUS_LABEL: Record<string, string> = {
  archived: 'Archived',
  full: 'Full',
}

export function EventCard({
  event,
  href,
  actions,
  hoursLabel,
  distanceLabel,
  vendorCount,
  capacityLabel,
  displayStatus,
  showBookingMode = false,
}: EventCardProps) {
  const badgeStatus = displayStatus ?? event.status
  const isGarageSale = (event.listing_type ?? 'community_market') === 'garage_yard_sale'
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
            className={`absolute right-2 top-2 border capitalize text-xs ${STATUS_BADGE[badgeStatus] ?? marketStatusBadge.neutral}`}
          >
            {STATUS_LABEL[badgeStatus] ?? badgeStatus}
          </Badge>
          {isGarageSale ? (
            <Badge className="absolute right-2 top-10 border bg-indigo-100 text-[10px] text-indigo-800">
              🏡 Garage / Yard Sale
            </Badge>
          ) : null}
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
            {capacityLabel ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 text-harvest-500" />
                {capacityLabel}
              </p>
            ) : null}
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
