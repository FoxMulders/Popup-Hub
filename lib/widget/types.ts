import type { ActivePortal } from '@/lib/portals/active-portal'
import type { NotificationType, Role } from '@/types/database'

export type WidgetPersona = 'patron' | 'vendor' | 'coordinator'

export type WidgetMarketSummary = {
  id: string
  name: string
  status: string
  startAt: string | null
  endAt: string | null
  locationName: string | null
  deepLink: string
}

export type WidgetNotificationItem = {
  id: string
  type: NotificationType
  message: string
  isRead: boolean
  createdAt: string
  deepLink: string | null
}

export type WidgetTransactionItem = {
  id: string
  amountCents: number
  type: string
  createdAt: string
  label: string
}

export type WidgetFundsSnapshot = {
  balanceCents: number
  recentTransactions: WidgetTransactionItem[]
  addFundsDeepLink: string
}

export type WidgetVendorApplicationsSnapshot = {
  approvedCount: number
  pendingReviewCount: number
  paymentDueCount: number
  urgentPaymentCount: number
  nearestPaymentDueAt: string | null
  applicationsDeepLink: string
}

export type WidgetCoordinatorEventPulse = {
  activeCount: number
  preparingCount: number
  issueCount: number
  nextEvent: WidgetMarketSummary | null
  actionRequiredCount: number
  pendingApplicationsCount: number
  boothFeesCollectedCents: number
  boothFeesOutstandingCents: number
  occupancyPercent: number | null
  checkInProgress: { checkedIn: number; total: number } | null
  checkInDeepLink: string | null
  studioDeepLink: string
}

export type WidgetPatronFeed = {
  persona: 'patron'
  generatedAt: string
  nearbyMarkets: WidgetMarketSummary[]
  favoriteMarkets: WidgetMarketSummary[]
  nextMarketCountdownMs: number | null
  unreadNotifications: number
  notifications: WidgetNotificationItem[]
  vendorOfTheDay: {
    vendorId: string
    businessName: string
    logoUrl: string | null
    deepLink: string
  } | null
  recentActivity: Array<{ id: string; message: string; deepLink: string }>
  marketFilter: 'all' | 'farmers' | 'artisan'
  discoverDeepLink: string
  notificationsDeepLink: string
}

export type WidgetVendorFeed = {
  persona: 'vendor'
  generatedAt: string
  funds: WidgetFundsSnapshot
  applications: WidgetVendorApplicationsSnapshot
  unreadNotifications: number
  notifications: WidgetNotificationItem[]
  activeMarket: WidgetMarketSummary | null
  dailyInterestCount: number
  checkInAvailable: boolean
  flashUpdateDeepLink: string | null
  notificationsDeepLink: string
}

export type WidgetCoordinatorFeed = {
  persona: 'coordinator'
  generatedAt: string
  eventPulse: WidgetCoordinatorEventPulse
  unreadNotifications: number
  notifications: WidgetNotificationItem[]
  approvalQueue: Array<{
    id: string
    vendorName: string
    eventName: string
    appliedAt: string
    deepLink: string
  }>
  latestVendorMessage: { vendorName: string; snippet: string; deepLink: string } | null
  notificationsDeepLink: string
}

export type WidgetFeedPayload = WidgetPatronFeed | WidgetVendorFeed | WidgetCoordinatorFeed

export type WidgetAuthContext = {
  userId: string
  role: Role
  activePortal: ActivePortal
  persona: WidgetPersona
  tokenId: string
}

export type WidgetSnapshot = {
  userId: string
  role: Role
  activePortal: ActivePortal
  persona: WidgetPersona
  apiBaseUrl: string
  savedAt: string
}
