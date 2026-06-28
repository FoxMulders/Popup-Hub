import type { WidgetPatronFeed, WidgetVendorFeed, WidgetCoordinatorFeed } from '@/lib/widget/types'
import { noPopupHubMarketsNearby } from '@/lib/copy/popup-hub-discovery'

/** Format wallet balance for widget display (cents → dollars). */
export function formatWidgetBalanceCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Human-readable countdown from milliseconds. */
export function formatCountdownMs(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

/** Small-widget status line for patron persona. */
export function buildPatronStatusLine(feed: WidgetPatronFeed): string {
  const count = feed.nearbyMarkets.length
  if (count === 0) return noPopupHubMarketsNearby
  const countdown = formatCountdownMs(feed.nextMarketCountdownMs)
  if (countdown) return `${count} market${count === 1 ? '' : 's'} · ${countdown}`
  return `${count} market${count === 1 ? '' : 's'} nearby`
}

/** Small-widget status line for vendor persona. */
export function buildVendorStatusLine(feed: WidgetVendorFeed): string {
  if (feed.applications.paymentDueCount > 0) {
    return `${feed.applications.paymentDueCount} payment${feed.applications.paymentDueCount === 1 ? '' : 's'} due`
  }
  if (feed.unreadNotifications > 0) {
    return `${feed.unreadNotifications} new notification${feed.unreadNotifications === 1 ? '' : 's'}`
  }
  return `${formatWidgetBalanceCents(feed.funds.balanceCents)} balance`
}

/** Small-widget status line for coordinator persona. */
export function buildCoordinatorStatusLine(feed: WidgetCoordinatorFeed): string {
  const { eventPulse } = feed
  if (eventPulse.actionRequiredCount > 0) {
    return `${eventPulse.actionRequiredCount} action${eventPulse.actionRequiredCount === 1 ? '' : 's'} needed`
  }
  return `${eventPulse.activeCount} active · ${eventPulse.preparingCount} preparing`
}

/** Pick dynamic widget theme bucket from local hour (market hours vs evening). */
export function resolveWidgetThemeBucket(date: Date = new Date()): 'market_hours' | 'evening' | 'morning' {
  const hour = date.getHours()
  if (hour >= 6 && hour < 18) return 'market_hours'
  if (hour >= 18) return 'evening'
  return 'morning'
}

/** Cycle patron market filter for interactive toggle. */
export function cycleMarketFilter(current: WidgetPatronFeed['marketFilter']): WidgetPatronFeed['marketFilter'] {
  if (current === 'all') return 'farmers'
  if (current === 'farmers') return 'artisan'
  return 'all'
}

export function buildPatronFeedSummary(feed: WidgetPatronFeed) {
  return {
    statusLine: buildPatronStatusLine(feed),
    theme: resolveWidgetThemeBucket(new Date(feed.generatedAt)),
    unread: feed.unreadNotifications,
  }
}

export function buildVendorFeedSummary(feed: WidgetVendorFeed) {
  return {
    statusLine: buildVendorStatusLine(feed),
    theme: resolveWidgetThemeBucket(new Date(feed.generatedAt)),
    unread: feed.unreadNotifications,
    balanceLabel: formatWidgetBalanceCents(feed.funds.balanceCents),
  }
}

export function buildCoordinatorFeedSummary(feed: WidgetCoordinatorFeed) {
  return {
    statusLine: buildCoordinatorStatusLine(feed),
    theme: resolveWidgetThemeBucket(new Date(feed.generatedAt)),
    unread: feed.unreadNotifications,
  }
}
