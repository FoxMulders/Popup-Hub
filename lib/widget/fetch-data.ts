import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { isApplicationAwaitingBoothPayment, isApplicationPaid } from '@/lib/applications/payment-fields'
import { ensureVendorInterestDaily } from '@/lib/widget/interest-daily'
import type {
  WidgetCoordinatorEventPulse,
  WidgetCoordinatorFeed,
  WidgetMarketSummary,
  WidgetPatronFeed,
  WidgetPersona,
  WidgetVendorFeed,
} from '@/lib/widget/types'
import type { BoothApplication, Event, Notification, WalletTransaction } from '@/types/database'

const OPEN_STATUSES = ['published', 'active'] as const

function eventDeepLink(eventId: string): string {
  return `/events/${eventId}`
}

function mapEventSummary(event: Pick<Event, 'id' | 'name' | 'status' | 'start_at' | 'end_at' | 'location_name'>): WidgetMarketSummary {
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    startAt: event.start_at,
    endAt: event.end_at,
    locationName: event.location_name,
    deepLink: eventDeepLink(event.id),
  }
}

function mapNotifications(rows: Notification[]): WidgetPatronFeed['notifications'] {
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at,
    deepLink: typeof n.metadata?.deep_link === 'string' ? n.metadata.deep_link : null,
  }))
}

function transactionLabel(type: string): string {
  switch (type) {
    case 'deposit':
      return 'Deposit'
    case 'withdrawal':
      return 'Withdrawal'
    case 'booth_payment':
      return 'Booth payment'
    case 'auction_bid':
      return 'Auction bid'
    case 'auction_win':
      return 'Auction win'
    case 'refund':
      return 'Refund'
    default:
      return type.replace(/_/g, ' ')
  }
}

async function fetchNotifications(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  const rows = (data ?? []) as Notification[]
  const unread = rows.filter((n) => !n.is_read).length
  return { rows, unread, mapped: mapNotifications(rows.slice(0, 3)) }
}

async function fetchWallet(supabase: SupabaseClient, userId: string) {
  const { data: walletRow } = await supabase.from('wallets').select('id, balance').eq('user_id', userId).maybeSingle()

  let txRows: WalletTransaction[] = []
  if (walletRow?.id) {
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletRow.id)
      .order('created_at', { ascending: false })
      .limit(3)
    txRows = (transactions ?? []) as WalletTransaction[]
  }

  return {
    balanceCents: walletRow?.balance ?? 0,
    recentTransactions: txRows.map((t) => ({
      id: t.id,
      amountCents: t.amount,
      type: t.type,
      createdAt: t.created_at,
      label: transactionLabel(t.type),
    })),
  }
}

async function fetchOpenMarkets(supabase: SupabaseClient): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('id, name, status, start_at, end_at, location_name, latitude, longitude')
    .in('status', [...OPEN_STATUSES])
    .eq('is_test', false)
    .order('start_at', { ascending: true })
    .limit(20)
  return (data ?? []) as Event[]
}

async function fetchPatronFeed(
  supabase: SupabaseClient,
  userId: string,
  marketFilter: WidgetPatronFeed['marketFilter'] = 'all'
): Promise<WidgetPatronFeed> {
  const [{ rows: notifications, unread, mapped }, openMarkets, favoritesRes, vendorOfDay, feedPosts] =
    await Promise.all([
      fetchNotifications(supabase, userId),
      fetchOpenMarkets(supabase),
      supabase.from('shopper_favorites').select('event_id').eq('user_id', userId),
      fetchVendorOfTheDay(supabase),
      fetchRecentMarketActivity(supabase),
    ])

  const favoriteIds = new Set((favoritesRes.data ?? []).map((f) => f.event_id))
  const favoriteMarkets = openMarkets.filter((e) => favoriteIds.has(e.id)).slice(0, 3).map(mapEventSummary)
  const nearbyMarkets = openMarkets.slice(0, 3).map(mapEventSummary)

  const nextStart = openMarkets.find((e) => e.start_at && new Date(e.start_at).getTime() > Date.now())
  const nextMarketCountdownMs = nextStart?.start_at
    ? Math.max(0, new Date(nextStart.start_at).getTime() - Date.now())
    : null

  return {
    persona: 'patron',
    generatedAt: new Date().toISOString(),
    nearbyMarkets,
    favoriteMarkets,
    nextMarketCountdownMs,
    unreadNotifications: unread,
    notifications: mapped,
    vendorOfTheDay: vendorOfDay,
    recentActivity: feedPosts,
    marketFilter,
    discoverDeepLink: '/discover',
    notificationsDeepLink: '/notifications',
  }
}

async function fetchVendorOfTheDay(supabase: SupabaseClient) {
  const daySeed = new Date().toISOString().slice(0, 10)
  const { data: passports } = await supabase
    .from('vendor_passports')
    .select('user_id, business_name, logo_url, is_verified')
    .eq('is_verified', true)
    .order('business_name', { ascending: true })
    .limit(50)

  const list = passports ?? []
  if (list.length === 0) return null

  let hash = 0
  for (let i = 0; i < daySeed.length; i++) {
    hash = (hash * 31 + daySeed.charCodeAt(i)) >>> 0
  }
  const pick = list[hash % list.length]

  return {
    vendorId: pick.user_id as string,
    businessName: pick.business_name as string,
    logoUrl: (pick.logo_url as string | null) ?? null,
    deepLink: `/patrons/${pick.user_id}`,
  }
}

async function fetchRecentMarketActivity(supabase: SupabaseClient) {
  const { data: posts } = await supabase
    .from('market_feed_posts')
    .select('id, caption, event_id, vendor_id')
    .order('created_at', { ascending: false })
    .limit(5)

  return (posts ?? []).map((p) => ({
    id: p.id as string,
    message: String(p.caption ?? 'New market update'),
    deepLink: `/events/${p.event_id}`,
  }))
}

async function fetchVendorFeed(supabase: SupabaseClient, userId: string): Promise<WidgetVendorFeed> {
  const [
    { rows: notifications, unread, mapped },
    wallet,
    appsRes,
    activeMarketRes,
    interestRes,
  ] = await Promise.all([
    fetchNotifications(supabase, userId),
    fetchWallet(supabase, userId),
    supabase
      .from('booth_applications')
      .select('id, status, payment_status, payment_method, application_payment_status, payment_due_at, event_id')
      .eq('vendor_id', userId),
    supabase
      .from('booth_applications')
      .select('event:events!inner(id, name, status, start_at, end_at, location_name)')
      .eq('vendor_id', userId)
      .eq('status', 'approved')
      .limit(5),
    ensureVendorInterestDaily(supabase, userId).catch(() => ({ followCount: 0, viewCount: 0 })),
  ])

  const apps = (appsRes.data ?? []) as BoothApplication[]
  const awaitingPayment = apps.filter((a) => isApplicationAwaitingBoothPayment(a))
  const nowMs = Date.now()
  const urgentPaymentCount = awaitingPayment.filter(
    (a) => a.payment_due_at && new Date(a.payment_due_at).getTime() - nowMs <= 24 * 60 * 60 * 1000
  ).length
  const nearestPaymentDueAt =
    awaitingPayment
      .map((a) => a.payment_due_at)
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null

  const activeEvents = (activeMarketRes.data ?? [])
    .map((row) => {
      const event = Array.isArray(row.event) ? row.event[0] : row.event
      if (!event || !OPEN_STATUSES.includes(event.status as (typeof OPEN_STATUSES)[number])) return null
      return mapEventSummary(event as Event)
    })
    .filter((e): e is WidgetMarketSummary => e !== null)

  const activeMarket = activeEvents[0] ?? null

  return {
    persona: 'vendor',
    generatedAt: new Date().toISOString(),
    funds: {
      balanceCents: wallet.balanceCents,
      recentTransactions: wallet.recentTransactions,
      addFundsDeepLink: '/wallet',
    },
    applications: {
      approvedCount: apps.filter((a) => a.status === 'approved').length,
      pendingReviewCount: apps.filter((a) => a.status === 'pending' || a.status === 'pending_insurance').length,
      paymentDueCount: awaitingPayment.length,
      urgentPaymentCount,
      nearestPaymentDueAt,
      applicationsDeepLink: '/vendor/applications',
    },
    unreadNotifications: unread,
    notifications: mapped,
    activeMarket,
    dailyInterestCount: interestRes.followCount + interestRes.viewCount,
    checkInAvailable: activeMarket != null,
    flashUpdateDeepLink: activeMarket ? `/vendor/events/${activeMarket.id}` : null,
    notificationsDeepLink: '/notifications',
  }
}

async function fetchCoordinatorFeed(
  supabase: SupabaseClient,
  userId: string
): Promise<WidgetCoordinatorFeed> {
  const scope = await getCoordinatorScope(supabase, userId)
  const { rows: notifications, unread, mapped } = await fetchNotifications(supabase, userId)

  const eventsQuery = applyCoordinatorEventScope(
    supabase.from('events').select('id, name, status, start_at, end_at, location_name').order('start_at', { ascending: true }),
    userId,
    scope.isAdmin
  )
  const { data: events } = await eventsQuery

  const eventList = (events ?? []) as Event[]
  const activeCount = eventList.filter((e) => e.status === 'active').length
  const preparingCount = eventList.filter((e) => e.status === 'published' || e.status === 'draft').length

  const eventIds = eventList.map((e) => e.id)
  let pendingApplicationsCount = 0
  let approvalQueue: WidgetCoordinatorFeed['approvalQueue'] = []
  let boothFeesCollectedCents = 0
  let boothFeesOutstandingCents = 0
  let checkInProgress: WidgetCoordinatorEventPulse['checkInProgress'] = null
  let latestVendorMessage: WidgetCoordinatorFeed['latestVendorMessage'] = null
  let issueCount = 0

  const focusEvent =
    eventList.find((e) => e.status === 'active') ??
    eventList.find((e) => e.status === 'published' && e.start_at && new Date(e.start_at).getTime() > Date.now()) ??
    eventList[0] ??
    null

  if (eventIds.length > 0) {
    const [{ count: pendingCount }, { data: pendingApps }] = await Promise.all([
      supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .in('status', ['pending', 'pending_insurance']),
      supabase
        .from('booth_applications')
        .select(`
        id,
        applied_at,
        vendor:profiles!booth_applications_vendor_id_fkey(full_name),
        event:events!inner(id, name)
      `)
        .in('event_id', eventIds)
        .in('status', ['pending', 'pending_insurance'])
        .order('applied_at', { ascending: false })
        .limit(5),
    ])

    pendingApplicationsCount = pendingCount ?? 0
    approvalQueue = (pendingApps ?? []).map((a) => {
      const vendor = Array.isArray(a.vendor) ? a.vendor[0] : a.vendor
      const event = Array.isArray(a.event) ? a.event[0] : a.event
      return {
        id: a.id as string,
        vendorName: (vendor?.full_name as string) ?? 'Vendor',
        eventName: (event?.name as string) ?? 'Market',
        appliedAt: a.applied_at as string,
        deepLink: `/coordinator/events/${event?.id}/applications`,
      }
    })

    const { data: approvedApps } = await supabase
      .from('booth_applications')
      .select(`
        payment_status,
        payment_method,
        application_payment_status,
        checked_in,
        event_id,
        category_id,
        event:events!inner(id)
      `)
      .in('event_id', eventIds)
      .eq('status', 'approved')

    const categoryPriceMap: Record<string, number> = {}
    if (eventIds.length > 0) {
      const { data: limits } = await supabase
        .from('event_category_limits')
        .select('event_id, category_id, price_per_booth')
        .in('event_id', eventIds)
      for (const limit of limits ?? []) {
        categoryPriceMap[`${limit.event_id}:${limit.category_id}`] = Math.round(
          (limit.price_per_booth ?? 0) * 100
        )
      }
    }

    for (const app of approvedApps ?? []) {
      const key = `${app.event_id}:${app.category_id}`
      const price = categoryPriceMap[key] ?? 0
      const paymentFields = app as Pick<
        BoothApplication,
        'payment_status' | 'payment_method' | 'application_payment_status'
      >
      if (isApplicationPaid(paymentFields)) {
        boothFeesCollectedCents += price
      } else if (price > 0) {
        boothFeesOutstandingCents += price
      }
    }

    if (focusEvent) {
      const focusApps = (approvedApps ?? []).filter((a) => a.event_id === focusEvent.id)
      const checkedIn = focusApps.filter((a) => a.checked_in === true).length
      checkInProgress = { checkedIn, total: focusApps.length }

      const { count: openIncidents } = await supabase
        .from('coordinator_incidents')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', focusEvent.id)
        .eq('status', 'open')
      issueCount = openIncidents ?? 0

      const { data: messages } = await supabase
        .from('coordinator_vendor_messages')
        .select('body, vendor:profiles!coordinator_vendor_messages_vendor_id_fkey(full_name), event_id')
        .eq('event_id', focusEvent.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const msg = messages?.[0]
      if (msg) {
        const vendor = Array.isArray(msg.vendor) ? msg.vendor[0] : msg.vendor
        latestVendorMessage = {
          vendorName: (vendor?.full_name as string) ?? 'Vendor',
          snippet: String(msg.body ?? '').slice(0, 120),
          deepLink: `/coordinator/events/${focusEvent.id}/operations`,
        }
      }
    }
  }

  const { data: capacityRow } = focusEvent
    ? await supabase
        .from('event_category_limits')
        .select('max_slots')
        .eq('event_id', focusEvent.id)
    : { data: [] }

  const maxSlots = (capacityRow ?? []).reduce((sum, row) => sum + (row.max_slots ?? 0), 0)
  const filled = checkInProgress?.total ?? 0
  const occupancyPercent = maxSlots > 0 ? Math.min(100, Math.round((filled / maxSlots) * 100)) : null

  const nextEvent = focusEvent ? mapEventSummary(focusEvent) : null

  return {
    persona: 'coordinator',
    generatedAt: new Date().toISOString(),
    eventPulse: {
      activeCount,
      preparingCount,
      issueCount,
      nextEvent,
      actionRequiredCount: pendingApplicationsCount + issueCount,
      pendingApplicationsCount,
      boothFeesCollectedCents,
      boothFeesOutstandingCents,
      occupancyPercent,
      checkInProgress,
      checkInDeepLink: focusEvent ? `/coordinator/events/${focusEvent.id}/checkin` : null,
      studioDeepLink: focusEvent ? `/coordinator/studio?event=${focusEvent.id}` : '/coordinator/studio',
    },
    unreadNotifications: unread,
    notifications: mapped,
    approvalQueue,
    latestVendorMessage,
    notificationsDeepLink: '/notifications',
  }
}

export async function buildWidgetFeed(
  supabase: SupabaseClient,
  userId: string,
  persona: WidgetPersona,
  options?: { marketFilter?: WidgetPatronFeed['marketFilter'] }
): Promise<WidgetPatronFeed | WidgetVendorFeed | WidgetCoordinatorFeed> {
  switch (persona) {
    case 'vendor':
      return fetchVendorFeed(supabase, userId)
    case 'coordinator':
      return fetchCoordinatorFeed(supabase, userId)
    default:
      return fetchPatronFeed(supabase, userId, options?.marketFilter ?? 'all')
  }
}
