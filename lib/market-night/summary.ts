import type { SupabaseClient } from '@supabase/supabase-js'
import { buildVendorProfileHref } from '@/lib/shopper/vendors'

export interface DiscoveredVendor {
  vendorId: string
  businessName: string
  logoUrl: string | null
  categoryName: string | null
  boothNumber: number | null
  scannedAt: string
  bio: string | null
  websiteUrl: string | null
  shopUrl: string | null
  instagramUrl: string | null
  profileHref: string
}

export interface BackedItemEntry {
  entryId: string
  paddleNumber: string
  creditsSpent: number
  enteredAt: string
}

export interface BackedItem {
  catalogItemId: string
  title: string
  description: string | null
  imageUrl: string | null
  vendorId: string
  vendorName: string
  retailValueCents: number | null
  itemStatus: string
  winningPaddleNumber: string | null
  won: boolean
  entries: BackedItemEntry[]
  totalCreditsSpent: number
}

export interface MyNightSummary {
  eventId: string
  eventName: string
  eventEndAt: string | null
  checkedInAt: string | null
  paddleNumber: number | null
  discoveredVendors: DiscoveredVendor[]
  backedItems: BackedItem[]
}

export async function getMyNightSummary(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<MyNightSummary | null> {
  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, end_at')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status !== 'completed') {
    return null
  }

  const [
    { data: checkIn },
    { data: scans },
    { data: eventItems },
    { data: applications },
  ] = await Promise.all([
    supabase
      .from('market_patron_check_ins')
      .select('checked_in_at, paddle_number')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('passport_scans')
      .select('id, vendor_id, scanned_at')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .order('scanned_at', { ascending: true }),
    supabase.from('auction_catalog_items').select('id').eq('event_id', eventId),
    supabase
      .from('booth_applications')
      .select(`
        vendor_id,
        booth_number,
        category:categories(name),
        passport:vendor_passports(
          business_name,
          bio,
          logo_url,
          website_url,
          shop_url,
          instagram_url,
          is_verified
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'approved'),
  ])

  const catalogItemIds = (eventItems ?? []).map((row) => row.id as string)

  const { data: entries } =
    catalogItemIds.length > 0
      ? await supabase
          .from('auction_item_entries')
          .select(`
            id,
            catalog_item_id,
            paddle_number,
            credits_spent,
            entered_at,
            catalog_item:auction_catalog_items(
              id,
              event_id,
              vendor_id,
              title,
              description,
              image_url,
              retail_value_cents,
              status,
              winning_paddle_number,
              winner_user_id
            )
          `)
          .eq('user_id', userId)
          .in('catalog_item_id', catalogItemIds)
          .order('entered_at', { ascending: true })
      : { data: [] }

  const vendorIdsFromScans = [...new Set((scans ?? []).map((s) => s.vendor_id as string))]
  const vendorIdsFromItems = new Set<string>()
  for (const entry of entries ?? []) {
    const item = Array.isArray(entry.catalog_item)
      ? entry.catalog_item[0]
      : entry.catalog_item
    if (item?.vendor_id) vendorIdsFromItems.add(item.vendor_id as string)
  }

  const allVendorIds = [...new Set([...vendorIdsFromScans, ...vendorIdsFromItems])]

  type ApprovedApplication = NonNullable<typeof applications>[number]

  const appByVendor = new Map<string, ApprovedApplication>()
  for (const app of applications ?? []) {
    appByVendor.set(app.vendor_id as string, app)
  }

  const scanByVendor = new Map<string, string>()
  for (const scan of scans ?? []) {
    scanByVendor.set(scan.vendor_id as string, scan.scanned_at as string)
  }

  const discoveredVendors: DiscoveredVendor[] = vendorIdsFromScans.map((vendorId) => {
    const app = appByVendor.get(vendorId)
    const passport = Array.isArray(app?.passport) ? app?.passport[0] : app?.passport
    const category = Array.isArray(app?.category) ? app?.category[0] : app?.category

    return {
      vendorId,
      businessName: passport?.business_name ?? 'Local maker',
      logoUrl: passport?.logo_url ?? null,
      categoryName: category?.name ?? null,
      boothNumber: app?.booth_number ?? null,
      scannedAt: scanByVendor.get(vendorId) ?? new Date().toISOString(),
      bio: passport?.bio ?? null,
      websiteUrl: passport?.website_url ?? null,
      shopUrl: passport?.shop_url ?? null,
      instagramUrl: passport?.instagram_url ?? null,
      profileHref: buildVendorProfileHref(eventId, vendorId),
    }
  })

  const itemMap = new Map<string, BackedItem>()

  for (const row of entries ?? []) {
    const rawItem = Array.isArray(row.catalog_item) ? row.catalog_item[0] : row.catalog_item
    if (!rawItem) continue

    const catalogItemId = rawItem.id as string
    const vendorId = rawItem.vendor_id as string
    const app = appByVendor.get(vendorId)
    const passport = Array.isArray(app?.passport) ? app?.passport[0] : app?.passport
    const vendorName = passport?.business_name ?? 'Vendor'
    const winningPaddle = rawItem.winning_paddle_number as string | null
    const winnerUserId = rawItem.winner_user_id as string | null
    const won =
      !!winningPaddle &&
      winnerUserId === userId &&
      (row.paddle_number as string) === winningPaddle

    const entry: BackedItemEntry = {
      entryId: row.id as string,
      paddleNumber: row.paddle_number as string,
      creditsSpent: row.credits_spent as number,
      enteredAt: row.entered_at as string,
    }

    const existing = itemMap.get(catalogItemId)
    if (existing) {
      existing.entries.push(entry)
      existing.totalCreditsSpent += entry.creditsSpent
      existing.won = existing.won || won
    } else {
      itemMap.set(catalogItemId, {
        catalogItemId,
        title: rawItem.title as string,
        description: (rawItem.description as string | null) ?? null,
        imageUrl: (rawItem.image_url as string | null) ?? null,
        vendorId,
        vendorName,
        retailValueCents: (rawItem.retail_value_cents as number | null) ?? null,
        itemStatus: rawItem.status as string,
        winningPaddleNumber: winningPaddle,
        won,
        entries: [entry],
        totalCreditsSpent: entry.creditsSpent,
      })
    }
  }

  const backedItems = [...itemMap.values()].sort((a, b) => {
    const aTime = a.entries[0]?.enteredAt ?? ''
    const bTime = b.entries[0]?.enteredAt ?? ''
    return aTime.localeCompare(bTime)
  })

  return {
    eventId,
    eventName: event.name,
    eventEndAt: event.end_at ?? null,
    checkedInAt: checkIn?.checked_in_at ?? null,
    paddleNumber: checkIn?.paddle_number ?? null,
    discoveredVendors,
    backedItems,
  }
}
