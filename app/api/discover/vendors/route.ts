import { NextResponse } from 'next/server'
import { resolveDiscoverFilterDate } from '@/lib/shopper/discover-date'
import { filterDiscoverEventsByScope } from '@/lib/shopper/discover-scope'
import {
  buildCategoryMarketSummaries,
  searchDiscoverVendors,
} from '@/lib/shopper/discover-vendor-search'
import {
  filterEventsByRadius,
  sortEventsByDistance,
  type EventWithMeta,
} from '@/lib/shopper/events'
import { getCachedDiscoverMarkets } from '@/lib/queries/cached-public-markets'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import type { LatLng } from '@/lib/shopper/geo'

function parseOrigin(lat: string | null, lng: string | null): LatLng | null {
  if (!lat || !lng) return null
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { lat: latitude, lng: longitude }
}

function parseRadiusKm(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const categoryId = url.searchParams.get('category')?.trim() ?? ''
    const chipsOnly = url.searchParams.get('chipsOnly') === '1'
    const when = url.searchParams.get('when')
    const date = url.searchParams.get('date')
    const live = url.searchParams.get('live')
    const origin = parseOrigin(url.searchParams.get('lat'), url.searchParams.get('lng'))
    const radiusKm = parseRadiusKm(url.searchParams.get('radiusKm'))

    const { preset: datePreset, date: filterDate } = resolveDiscoverFilterDate(when, date)
    const listingType = live === 'auctions' ? 'garage_yard_sale' : 'community_market'

    const events = await getCachedDiscoverMarkets()
    const scoped = filterDiscoverEventsByScope(events, {
      datePreset,
      filterDate,
      listingType,
    })

    let withMeta: EventWithMeta[] = scoped
    if (origin) {
      withMeta = sortEventsByDistance(scoped, origin)
      withMeta = filterEventsByRadius(withMeta, radiusKm)
    }

    const eventIds = withMeta.map((e) => e.id)
    const supabase = createPublicSupabaseClient()
    const hasTextQuery = Boolean(q)
    const hasCategory = Boolean(categoryId)

    if (chipsOnly) {
      const { categoryChips } = await searchDiscoverVendors(supabase, { eventIds })
      return NextResponse.json({ categoryChips, eventCount: eventIds.length })
    }

    const { vendors, categoryChips, rows } = await searchDiscoverVendors(supabase, {
      q: q || undefined,
      categoryId: categoryId || undefined,
      eventIds,
    })

    const markets =
      hasCategory && !hasTextQuery
        ? buildCategoryMarketSummaries(rows, categoryId, withMeta)
        : []

    const vendorsWithDistance = vendors.map((vendor) => ({
      ...vendor,
      markets: vendor.markets.map((market) => {
        const event = withMeta.find((e) => e.id === market.eventId)
        return {
          ...market,
          distanceKm: event?.distance_km,
        }
      }),
    }))

    return NextResponse.json({
      vendors: vendorsWithDistance,
      markets,
      categoryChips,
      eventCount: eventIds.length,
    })
  } catch (error) {
    console.error('[discover/vendors]', error)
    return NextResponse.json({ error: 'Vendor search failed' }, { status: 500 })
  }
}
