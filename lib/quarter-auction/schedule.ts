import { format } from 'date-fns'

export function effectiveQuarterAuctionStart(
  scheduledStartAt: string | null | undefined,
  eventStartAt: string | null | undefined
): Date | null {
  if (scheduledStartAt) return new Date(scheduledStartAt)
  if (eventStartAt) return new Date(eventStartAt)
  return null
}

export function canStartQuarterAuctionNow(
  scheduledStartAt: string | null | undefined,
  eventStartAt: string | null | undefined,
  now = new Date()
): boolean {
  const start = effectiveQuarterAuctionStart(scheduledStartAt, eventStartAt)
  if (!start) return true
  return now.getTime() >= start.getTime()
}

export function quarterAuctionStartBlockedMessage(
  scheduledStartAt: string | null | undefined,
  eventStartAt: string | null | undefined
): string {
  const start = effectiveQuarterAuctionStart(scheduledStartAt, eventStartAt)
  if (!start) return 'Auction cannot start yet.'
  return `Auction cannot start until the advertised time (${format(start, 'MMM d · h:mm a')}).`
}

export function msUntilQuarterAuctionStart(
  scheduledStartAt: string | null | undefined,
  eventStartAt: string | null | undefined,
  now = new Date()
): number | null {
  const start = effectiveQuarterAuctionStart(scheduledStartAt, eventStartAt)
  if (!start) return null
  return Math.max(0, start.getTime() - now.getTime())
}
