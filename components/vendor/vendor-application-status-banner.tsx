import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCircle, Clock, XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { vendorApplicationStatusHref } from '@/components/vendor/market-owner-link'
import type { Notification } from '@/types/database'

interface VendorApplicationStatusBannerProps {
  notifications: Notification[]
  className?: string
}

function statusIcon(type: Notification['type']) {
  switch (type) {
    case 'application_approved':
      return <CheckCircle className="h-4 w-4 text-forest shrink-0" aria-hidden />
    case 'application_rejected':
      return <XCircle className="h-4 w-4 text-terracotta-600 shrink-0" aria-hidden />
    case 'waitlist_triggered':
      return <Clock className="h-4 w-4 text-harvest-600 shrink-0" aria-hidden />
    default:
      return <Bell className="h-4 w-4 text-forest shrink-0" aria-hidden />
  }
}

function eventHref(notification: Notification): string {
  const eventId =
    notification.metadata &&
    typeof notification.metadata === 'object' &&
    'event_id' in notification.metadata &&
    typeof notification.metadata.event_id === 'string'
      ? notification.metadata.event_id
      : null

  return eventId ? vendorApplicationStatusHref(eventId) : '/vendor/applications'
}

export function VendorApplicationStatusBanner({
  notifications,
  className,
}: VendorApplicationStatusBannerProps) {
  if (notifications.length === 0) return null

  return (
    <section
      className={cn(
        'space-y-3 rounded-xl border-2 border-forest/25 bg-sage-50 px-4 py-4 text-sm shadow-[var(--shadow-market)]',
        className
      )}
      aria-labelledby="vendor-application-status-updates"
    >
      <p
        id="vendor-application-status-updates"
        className="inline-flex items-center gap-2 font-heading text-sm font-bold text-forest"
      >
        <Bell className="h-4 w-4" aria-hidden />
        Application status update{notifications.length === 1 ? '' : 's'}
      </p>

      <ul className="space-y-2">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-sage-200 bg-white px-3 py-3"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {statusIcon(notification.type)}
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground leading-snug">{notification.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Link
              href={eventHref(notification)}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              View application
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        <Link href="/notifications" className="font-medium text-forest underline-offset-2 hover:underline">
          Open all notifications
        </Link>
      </p>
    </section>
  )
}
