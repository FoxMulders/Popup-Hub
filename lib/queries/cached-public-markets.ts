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
    .select('*, event_days(*)')
    .in('status', OPEN_MARKET_STATUSES)
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

export const getCachedVendorDirectoryCapacitySummaries = unstable_cache(
  fetchVendorDirectoryCapacitySummaries,
  ['public-vendor-directory-capacity'],
  {
    revalidate: PUBLIC_MARKETS_REVALIDATE_SECONDS,
    tags: [PUBLIC_MARKETS_CACHE_TAG],
  }
)
