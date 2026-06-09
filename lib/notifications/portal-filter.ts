import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Notification, NotificationType } from '@/types/database'

/** Notification types surfaced in the Patron portal feed. */
const PATRON_TYPES = new Set<NotificationType>([
  'waitlist_triggered',
  'waitlist_promoted',
  'market_reminder',
  'vendor_flash_sale',
  'priority_booth_invite',
  'vendor_sold_out',
  'auction_won',
  'auction_starting',
])

/** Notification types surfaced in the Vendor portal feed. */
const VENDOR_TYPES = new Set<NotificationType>([
  'application_approved',
  'application_rejected',
  'application_follow_up',
  'payment_failed',
  'vendor_access_approved',
  'vendor_access_rejected',
  'payment_received',
  'coordinator_announcement',
])

/** Notification types surfaced in the Coordinator portal feed. */
const COORDINATOR_TYPES = new Set<NotificationType>([
  'application_follow_up',
  'market_feedback',
  'feedback_addressed',
  'coordinator_announcement',
  'event_cancelled',
  'payment_received',
])

export function notificationMatchesPortal(
  type: NotificationType,
  portal: ActivePortal
): boolean {
  switch (portal) {
    case 'vendor':
      return VENDOR_TYPES.has(type)
    case 'coordinator':
      return COORDINATOR_TYPES.has(type)
    case 'patron':
    default:
      return PATRON_TYPES.has(type)
  }
}

export function notificationTypesForPortal(portal: ActivePortal): NotificationType[] {
  switch (portal) {
    case 'vendor':
      return [...VENDOR_TYPES]
    case 'coordinator':
      return [...COORDINATOR_TYPES]
    case 'patron':
    default:
      return [...PATRON_TYPES]
  }
}

export function filterNotificationsForPortal(
  notifications: ReadonlyArray<Notification>,
  portal: ActivePortal
): Notification[] {
  return notifications.filter((n) => notificationMatchesPortal(n.type, portal))
}
