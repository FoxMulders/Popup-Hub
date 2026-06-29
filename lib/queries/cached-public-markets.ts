import { unstable_cache } from 'next/cache'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { fetchCapacitySummariesForEvents, type EventCapacitySummary } from '@/lib/queries/event-capacity'
import {
  VENDOR_EVENT_SELECT,
  VENDOR_MARKET_STATUSES,
  type OpenEventStatus,
} from '@/lib/queries/events'
import type { Event } from '@/types/database'

export const PUBLIC_MARKETS_CACHE_TAG = 'markets' as const
export const PUBLIC_MARKETS_REVALIDATE_SECONDS = 60

const OPEN_MARKET_STATUSES: OpenEventStatus[] = ['published', 'active']

async function fetchDiscoverMarkets(): Promise<Event[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('events')
    .select(
      '*, event_days(*), coordinator:profiles!events_coordinator_id_fkey(id, full_name, reliability_score, recent_late_cancellation_at, coordinator_is_verified)'
    )
    .in('status', OPEN_MARKET_STATUSES)
    .eq('is_test', false)
    .order('start_at', { ascending: true })

  if (error) throw new Error(`discover markets: ${error.message}`)
  return (data ?? []) as Event[]
}

async function fetchVendorDirectoryMarkets(): Promise<Event[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('events')
    .select(VENDOR_EVENT_SELECT)
    .in('status', VENDOR_MARKET_STATUSES)
    .eq('is_test', false)
    .order('start_at', { ascending: true })

  if (error) throw new Error(`vendor directory markets: ${error.message}`)
  return (data ?? []) as Event[]
}

async function fetchApprovedVendorCounts(): Promise<Record<string, number>> {
  const supabase = createPublicSupabaseClient()
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .in('status', OPEN_MARKET_STATUSES)
    .eq('is_test', false)

  if (eventsError) throw new Error(`vendor counts events: ${eventsError.message}`)

  const eventIds = (events ?? []).map((row) => row.id)
  if (eventIds.length === 0) return {}

  const { data: counts, error: countsError } = await supabase
    .from('booth_applications')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('status', 'approved')

  if (countsError) throw new Error(`vendor counts applications: ${countsError.message}`)

  const vendorCounts: Record<string, number> = {}
  for (const row of counts ?? []) {
    vendorCounts[row.event_id] = (vendorCounts[row.event_id] ?? 0) + 1
  }
  return vendorCounts
}

async function fetchActiveAuctionIdsByEvent(): Promise<Record<string, string>> {
  const supabase = createPublicSupabaseClient()
  const [{ data: timerAuctions, error: timerError }, { data: catalogLive, error: catalogError }] =
    await Promise.all([
      supabase
        .from('auctions')
        .select('id, event_id')
        .eq('status', 'active')
        .not('event_id', 'is', null),
      supabase
        .from('auction_catalog_items')
        .select('id, event_id')
        .in('status', ['bidding_open', 'bidding_closed', 'drawing']),
    ])

  if (timerError) throw new Error(`active auctions: ${timerError.message}`)
  if (catalogError) throw new Error(`active quarter auction catalog: ${catalogError.message}`)

  const byEvent: Record<string, string> = {}
  for (const row of timerAuctions ?? []) {
    if (row.event_id) byEvent[row.event_id] = row.id
  }
  for (const row of catalogLive ?? []) {
    if (row.event_id && !byEvent[row.event_id]) {
      byEvent[row.event_id] = row.id
    }
  }
  return byEvent
}

async function fetchVendorDirectoryCapacitySummaries(): Promise<Record<string, EventCapacitySummary>> {
  const events = await fetchVendorDirectoryMarkets()
  const supabase = createPublicSupabaseClient()
  return fetchCapacitySummariesForEvents(supabase, events)
}

export const getCachedDiscoverMarkets = unstable_cache(
  fetchDiscoverMarkets,
  ['public-discover-markets'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)

export const getCachedVendorDirectoryMarkets = unstable_cache(
  fetchVendorDirectoryMarkets,
  ['public-vendor-directory-markets'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)

export const getCachedApprovedVendorCounts = unstable_cache(
  fetchApprovedVendorCounts,
  ['public-approved-vendor-counts'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)

export const getCachedActiveAuctionIdsByEvent = unstable_cache(
  fetchActiveAuctionIdsByEvent,
  ['public-active-auction-event-ids'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)

export const getCachedVendorDirectoryCapacitySummaries = unstable_cache(
  fetchVendorDirectoryCapacitySummaries,
  ['public-vendor-directory-capacity'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)
