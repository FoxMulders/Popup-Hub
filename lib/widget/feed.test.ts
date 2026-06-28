import assert from 'node:assert/strict'
import {
  buildCoordinatorStatusLine,
  buildPatronStatusLine,
  buildVendorStatusLine,
  cycleMarketFilter,
  formatCountdownMs,
  formatWidgetBalanceCents,
  resolveWidgetThemeBucket,
} from '@/lib/widget/feed'
import type { WidgetCoordinatorFeed, WidgetPatronFeed, WidgetVendorFeed } from '@/lib/widget/types'

const patronFeed: WidgetPatronFeed = {
  persona: 'patron',
  generatedAt: '2026-06-27T14:00:00.000Z',
  nearbyMarkets: [
    {
      id: 'e1',
      name: 'Summer Market',
      status: 'published',
      startAt: '2026-06-28T10:00:00.000Z',
      endAt: null,
      locationName: 'Downtown',
      deepLink: '/events/e1',
    },
    {
      id: 'e2',
      name: 'Artisan Fair',
      status: 'active',
      startAt: '2026-06-27T09:00:00.000Z',
      endAt: null,
      locationName: 'Park',
      deepLink: '/events/e2',
    },
  ],
  favoriteMarkets: [],
  nextMarketCountdownMs: 90 * 60_000,
  unreadNotifications: 2,
  notifications: [],
  vendorOfTheDay: null,
  recentActivity: [],
  marketFilter: 'all',
  discoverDeepLink: '/discover',
  notificationsDeepLink: '/notifications',
}

const vendorFeed: WidgetVendorFeed = {
  persona: 'vendor',
  generatedAt: '2026-06-27T14:00:00.000Z',
  funds: {
    balanceCents: 4550,
    recentTransactions: [],
    addFundsDeepLink: '/wallet',
  },
  applications: {
    approvedCount: 2,
    pendingReviewCount: 1,
    paymentDueCount: 0,
    urgentPaymentCount: 0,
    nearestPaymentDueAt: null,
    applicationsDeepLink: '/vendor/applications',
  },
  unreadNotifications: 0,
  notifications: [],
  activeMarket: null,
  dailyInterestCount: 5,
  checkInAvailable: false,
  flashUpdateDeepLink: null,
  notificationsDeepLink: '/notifications',
}

const coordinatorFeed: WidgetCoordinatorFeed = {
  persona: 'coordinator',
  generatedAt: '2026-06-27T14:00:00.000Z',
  eventPulse: {
    activeCount: 2,
    preparingCount: 1,
    issueCount: 0,
    nextEvent: null,
    actionRequiredCount: 3,
    pendingApplicationsCount: 3,
    boothFeesCollectedCents: 120000,
    boothFeesOutstandingCents: 45000,
    occupancyPercent: 85,
    checkInProgress: { checkedIn: 15, total: 20 },
    checkInDeepLink: '/coordinator/events/e1/checkin',
    studioDeepLink: '/coordinator/studio',
  },
  unreadNotifications: 1,
  notifications: [],
  approvalQueue: [],
  latestVendorMessage: null,
  notificationsDeepLink: '/notifications',
}

assert.equal(formatWidgetBalanceCents(4550), '$45.50')
assert.equal(formatCountdownMs(90 * 60_000), '1h 30m')
assert.equal(formatCountdownMs(null), null)
assert.match(buildPatronStatusLine(patronFeed), /2 markets/)
assert.match(buildPatronStatusLine(patronFeed), /1h 30m/)
assert.equal(buildVendorStatusLine(vendorFeed), '$45.50 balance')
assert.match(buildCoordinatorStatusLine(coordinatorFeed), /3 actions needed/)
assert.equal(resolveWidgetThemeBucket(new Date('2026-06-27T14:00:00.000Z')), 'market_hours')
const eveningLocal = new Date()
eveningLocal.setHours(20, 0, 0, 0)
assert.equal(resolveWidgetThemeBucket(eveningLocal), 'evening')
assert.equal(cycleMarketFilter('all'), 'farmers')
assert.equal(cycleMarketFilter('farmers'), 'artisan')
assert.equal(cycleMarketFilter('artisan'), 'all')

console.log('widget feed tests passed')
