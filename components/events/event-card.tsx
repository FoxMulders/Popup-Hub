import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'
import { getEventDateLabel } from '@/lib/shopper/events'
import { marketStatusBadge } from '@/lib/theme/market'
import { vendorApplicationCardBadgeLabel } from '@/lib/vendor/application-status-ui'
import type { ApplicationStatus, Event } from '@/types/database'
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
  showMarketOwner?: boolean
  vendorApplicationStatus?: ApplicationStatus | null
  vendorApplicationsOpen?: boolean
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
  showMarketOwner = false,
  vendorApplicationStatus = null,
  vendorApplicationsOpen = true,
}: EventCardProps) {
  const badgeStatus = displayStatus ?? event.status
  const appliedLabel =
    vendorApplicationStatus != null
      ? vendorApplicationCardBadgeLabel(vendorApplicationStatus, vendorApplicationsOpen)
      : null
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const hours =
    hoursLabel ??
    `${format(new Date(event.start_at), 'h:mm a')} – ${format(new Date(event.end_at), 'h:mm a')}`
  const dateLabel = selectedDate
    ? getEventDateLabel(event, selectedDate)
    : format(new Date(event.start_at), 'EEE, MMM d, yyyy')

  return (
    <Card
      className={`group flex h-full flex-col overflow-hidden transition hover:shadow-[var(--shadow-market-md)]${
        appliedLabel ? ' ring-2 ring-harvest-300/70' : ''
      }`}
    >
      <div className="relative h-52 w-full overflow-hidden rounded-t-2xl border-b border-stone-200/60 bg-gradient-to-br from-sage-50 to-canvas">
        {event.cover_image_url ? (
          <ExpandableImage
            src={event.cover_image_url}
            alt={event.name}
            className="h-full w-full object-cover bg-canvas transition-transform duration-300 group-hover:scale-[1.03]"
            containerClassName="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-canvas">
            <MapPin className="h-12 w-12 text-harvest-300" />
          </div>
        )}
        <Badge
          className={`pointer-events-none absolute right-2 top-2 z-10 border capitalize text-xs ${STATUS_BADGE[badgeStatus] ?? marketStatusBadge.neutral}`}
        >
          {STATUS_LABEL[badgeStatus] ?? badgeStatus}
        </Badge>
        {distanceLabel ? (
          <Badge className="pointer-events-none absolute left-2 top-2 z-10 border bg-white/90 text-[10px] text-foreground">
            {distanceLabel}
          </Badge>
        ) : null}
        {appliedLabel ? (
          <Badge
            className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate border border-harvest-300 bg-white/95 text-[10px] font-semibold text-harvest-900 shadow-sm"
            aria-label={appliedLabel}
          >
            {appliedLabel}
          </Badge>
        ) : null}
        {liveAuctionId ? (
          <span
            className={`absolute z-10 inline-flex items-center rounded-md border border-harvest-300 bg-harvest-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ${
              appliedLabel ? 'bottom-2 right-2' : 'bottom-2 left-2'
            }`}
            aria-label="Live quarter auction at this market"
          >
            Live auction
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">
        <Link href={href} className="block flex-1">
          <CardContent className="p-4 pb-2">
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
        {showMarketOwner && coordinator?.full_name ? (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground">
              Market owner:{' '}
              <Link
                href={`/coordinators/${coordinator.id}`}
                className="font-medium text-harvest-700 hover:underline"
              >
                {coordinator.full_name}
              </Link>
            </p>
          </div>
        ) : null}
      </div>
      {actions ? <div className="border-t px-4 pb-4 pt-0">{actions}</div> : null}
    </Card>
  )
}
