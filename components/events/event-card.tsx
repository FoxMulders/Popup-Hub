import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import { getEventDateLabel } from '@/lib/shopper/events'
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
  capacityLabel?: string | null
  displayStatus?: EventDisplayStatus
  showBookingMode?: boolean
  selectedDate?: Date
  liveAuctionId?: string
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
  selectedDate,
  liveAuctionId,
}: EventCardProps) {
  const badgeStatus = displayStatus ?? event.status
  const hours =
    hoursLabel ??
    `${format(new Date(event.start_at), 'h:mm a')} – ${format(new Date(event.end_at), 'h:mm a')}`
  const dateLabel = selectedDate
    ? getEventDateLabel(event, selectedDate)
    : format(new Date(event.start_at), 'EEE, MMM d, yyyy')

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition hover:shadow-[var(--shadow-market-md)]">
      <Link href={href} className="block flex-1">
        <div className="relative h-48 w-full overflow-hidden rounded-t-xl border-b border-gray-100 bg-slate-50">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="h-full w-full object-contain bg-slate-50 transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-50">
              <MapPin className="h-12 w-12 text-harvest-300" />
            </div>
          )}
          <Badge
            className={`absolute right-2 top-2 border capitalize text-xs ${STATUS_BADGE[badgeStatus] ?? marketStatusBadge.neutral}`}
          >
            {STATUS_LABEL[badgeStatus] ?? badgeStatus}
          </Badge>
          {distanceLabel ? (
            <Badge className="absolute left-2 top-2 border bg-white/90 text-[10px] text-foreground">
              {distanceLabel}
            </Badge>
          ) : null}
          {liveAuctionId ? (
            <span
              className="absolute bottom-2 left-2 z-10 inline-flex items-center rounded-md border border-harvest-300 bg-harvest-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
              aria-label="Live quarter auction at this market"
            >
              Live auction
            </span>
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
              {dateLabel}
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
        </CardContent>
      </Link>
      {actions ? <div className="border-t px-4 pb-4 pt-0">{actions}</div> : null}
    </Card>
  )
}
