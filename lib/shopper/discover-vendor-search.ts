import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'
import { normalizeVendorSearchQuery, vendorTextMatchesSearch } from '@/lib/shopper/vendors'
import type { Event } from '@/types/database'
import type { EventWithMeta } from '@/lib/shopper/events'

export type DiscoverVendorMarketHit = {
  eventId: string
  eventName: string
  startAt: string
  endAt: string
  city: string | null
  latitude: number | null
  longitude: number | null
  boothNumber: number | null
  categoryName: string | null
  distanceKm?: number
}

export type DiscoverVendorHit = {
  vendorId: string
  businessName: string
  logoUrl: string | null
  primaryCategoryName: string | null
  markets: DiscoverVendorMarketHit[]
}

export type DiscoverCategoryChip = {
  id: string
  name: string
  count: number
}

export type DiscoverVendorApplicationRow = {
  vendorId: string
  eventId: string
  boothNumber: number | null
  applicationCategoryId: string | null
  applicationCategoryName: string | null
  businessName: string
  logoUrl: string | null
  bio: string | null
  primaryCategoryId: string | null
  primaryCategoryName: string | null
  categoryIds: string[] | null
  eventName: string
  startAt: string
  endAt: string
  city: string | null
  latitude: number | null
  longitude: number | null
}

export function vendorMatchesCategoryFilter(
  row: Pick<
    DiscoverVendorApplicationRow,
    'applicationCategoryId' | 'primaryCategoryId' | 'categoryIds'
  >,
  categoryId: string
): boolean {
  if (row.applicationCategoryId === categoryId) return true
  if (row.primaryCategoryId === categoryId) return true
  return (row.categoryIds ?? []).includes(categoryId)
}

export function rowMatchesDiscoverVendorFilters(
  row: DiscoverVendorApplicationRow,
  opts: { q?: string; categoryId?: string }
): boolean {
  if (opts.categoryId && !vendorMatchesCategoryFilter(row, opts.categoryId)) {
    return false
  }
  if (opts.q && !normalizeVendorSearchQuery(opts.q)) {
    return true
  }
  if (opts.q) {
    return vendorTextMatchesSearch(
      {
        businessName: row.businessName,
        categoryName: row.applicationCategoryName ?? row.primaryCategoryName,
        bio: row.bio,
      },
      opts.q
    )
  }
  return true
}

function mapApplicationRows(raw: Record<string, unknown>[]): DiscoverVendorApplicationRow[] {
  return raw.map((row) => {
    const event = Array.isArray(row.event) ? row.event[0] : row.event
    const passport = Array.isArray(row.passport) ? row.passport[0] : row.passport
    const category = Array.isArray(row.category) ? row.category[0] : row.category
    const primaryCategory = passport?.primary_category
      ? Array.isArray(passport.primary_category)
        ? passport.primary_category[0]
        : passport.primary_category
      : null

    return {
      vendorId: row.vendor_id as string,
      eventId: row.event_id as string,
      boothNumber: (row.booth_number as number | null) ?? null,
      applicationCategoryId: (row.category_id as string | null) ?? null,
      applicationCategoryName: (category?.name as string | undefined) ?? null,
      businessName:
        ((passport?.business_name as string | undefined)?.trim() || 'Vendor') as string,
      logoUrl: (passport?.logo_url as string | null | undefined) ?? null,
      bio: (passport?.bio as string | null | undefined) ?? null,
      primaryCategoryId: (passport?.primary_category_id as string | null | undefined) ?? null,
      primaryCategoryName: (primaryCategory?.name as string | undefined) ?? null,
      categoryIds: (passport?.category_ids as string[] | null | undefined) ?? null,
      eventName: (event?.name as string | undefined) ?? 'Market',
      startAt: (event?.start_at as string | undefined) ?? '',
      endAt: (event?.end_at as string | undefined) ?? '',
      city: (event?.city as string | null | undefined) ?? null,
      latitude: (event?.latitude as number | null | undefined) ?? null,
      longitude: (event?.longitude as number | null | undefined) ?? null,
    }
  })
}

export async function fetchDiscoverVendorApplications(
  supabase: SupabaseClient,
  eventIds: string[]
): Promise<DiscoverVendorApplicationRow[]> {
  if (eventIds.length === 0) return []

  const { data, error } = await supabase
    .from('booth_applications')
    .select(`
      vendor_id,
      event_id,
      booth_number,
      category_id,
      category:categories(id, name),
      passport:vendor_passports(
        business_name,
        bio,
        logo_url,
        primary_category_id,
        category_ids,
        primary_category:categories(name)
      ),
      event:events(
        id,
        name,
        start_at,
        end_at,
        city,
        latitude,
        longitude
      )
    `)
    .in('event_id', eventIds)
    .eq('status', 'approved')

  if (error) throw new Error(`discover vendor applications: ${error.message}`)
  return mapApplicationRows((data ?? []) as Record<string, unknown>[])
}

export function groupRowsIntoVendorHits(
  rows: DiscoverVendorApplicationRow[],
  opts: { q?: string; categoryId?: string }
): DiscoverVendorHit[] {
  const filtered = rows.filter((row) => rowMatchesDiscoverVendorFilters(row, opts))
  const byVendor = new Map<string, DiscoverVendorHit>()

  for (const row of filtered) {
    const market: DiscoverVendorMarketHit = {
      eventId: row.eventId,
      eventName: row.eventName,
      startAt: row.startAt,
      endAt: row.endAt,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      boothNumber: row.boothNumber,
      categoryName: row.applicationCategoryName ?? row.primaryCategoryName,
    }

    const existing = byVendor.get(row.vendorId)
    if (!existing) {
      byVendor.set(row.vendorId, {
        vendorId: row.vendorId,
        businessName: row.businessName,
        logoUrl: row.logoUrl,
        primaryCategoryName: row.primaryCategoryName ?? row.applicationCategoryName,
        markets: [market],
      })
      continue
    }

    if (!existing.markets.some((m) => m.eventId === row.eventId)) {
      existing.markets.push(market)
    }
  }

  return [...byVendor.values()]
    .map((hit) => ({
      ...hit,
      markets: hit.markets.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ),
    }))
    .sort((a, b) => a.businessName.localeCompare(b.businessName))
}

export function buildCategoryMarketSummaries(
  rows: DiscoverVendorApplicationRow[],
  categoryId: string,
  events: EventWithMeta[]
): Array<{
  event: EventWithMeta
  matchingVendorCount: number
  matchingVendorNames: string[]
}> {
  const eventById = new Map(events.map((e) => [e.id, e]))
  const byEvent = new Map<string, Set<string>>()
  const namesByEvent = new Map<string, string[]>()

  for (const row of rows) {
    if (!vendorMatchesCategoryFilter(row, categoryId)) continue
    const set = byEvent.get(row.eventId) ?? new Set<string>()
    set.add(row.vendorId)
    byEvent.set(row.eventId, set)

    const names = namesByEvent.get(row.eventId) ?? []
    if (!names.includes(row.businessName)) names.push(row.businessName)
    namesByEvent.set(row.eventId, names)
  }

  return events
    .filter((e) => byEvent.has(e.id))
    .map((event) => ({
      event,
      matchingVendorCount: byEvent.get(event.id)?.size ?? 0,
      matchingVendorNames: (namesByEvent.get(event.id) ?? []).slice(0, 3),
    }))
}

export function getDiscoverCategoryChips(
  rows: DiscoverVendorApplicationRow[]
): DiscoverCategoryChip[] {
  const counts = new Map<string, { id: string; name: string; count: number }>()

  for (const row of rows) {
    const categoryIds = new Set<string>()
    if (row.applicationCategoryId && row.applicationCategoryName) {
      categoryIds.add(row.applicationCategoryId)
      counts.set(row.applicationCategoryId, {
        id: row.applicationCategoryId,
        name: row.applicationCategoryName,
        count: (counts.get(row.applicationCategoryId)?.count ?? 0) + 1,
      })
    }
    const passportIds = resolvePassportCategoryIds({
      category_ids: row.categoryIds,
      primary_category_id: row.primaryCategoryId,
    })
    for (const id of passportIds) {
      if (categoryIds.has(id)) continue
      categoryIds.add(id)
      const name =
        id === row.primaryCategoryId
          ? row.primaryCategoryName
          : id === row.applicationCategoryId
            ? row.applicationCategoryName
            : null
      if (!name) continue
      counts.set(id, {
        id,
        name,
        count: (counts.get(id)?.count ?? 0) + 1,
      })
    }
  }

  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function searchDiscoverVendors(
  supabase: SupabaseClient,
  opts: {
    q?: string
    categoryId?: string
    eventIds: string[]
  }
): Promise<{
  vendors: DiscoverVendorHit[]
  categoryChips: DiscoverCategoryChip[]
  rows: DiscoverVendorApplicationRow[]
}> {
  const rows = await fetchDiscoverVendorApplications(supabase, opts.eventIds)
  const categoryChips = getDiscoverCategoryChips(rows)
  const hasTextQuery = Boolean(normalizeVendorSearchQuery(opts.q ?? ''))
  const hasCategory = Boolean(opts.categoryId)

  if (!hasTextQuery && !hasCategory) {
    return { vendors: [], categoryChips, rows }
  }

  const vendors = groupRowsIntoVendorHits(rows, {
    q: opts.q,
    categoryId: opts.categoryId,
  })

  return { vendors, categoryChips, rows }
}
