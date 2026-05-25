import type { SupabaseClient } from '@supabase/supabase-js'
import { buildVendorProfileHref } from '@/lib/shopper/vendors'

export interface MakerDirectoryEntry {
  vendorId: string
  businessName: string
  logoUrl: string | null
  categoryName: string | null
  bio: string | null
  websiteUrl: string | null
  shopUrl: string | null
  instagramUrl: string | null
  scanCount: number
  marketCount: number
  firstScannedAt: string
  lastScannedAt: string
  latestEventId: string
  latestEventName: string
  profileHref: string
}

/** All unique vendors a patron scanned across markets, newest interaction first. */
export async function getPatronMakersDirectory(
  supabase: SupabaseClient,
  userId: string
): Promise<MakerDirectoryEntry[]> {
  const { data: scans } = await supabase
    .from('passport_scans')
    .select(`
      vendor_id,
      event_id,
      scanned_at,
      event:events(id, name)
    `)
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })

  if (!scans?.length) return []

  type ScanRow = (typeof scans)[number]
  const byVendor = new Map<
    string,
    {
      scanCount: number
      eventIds: Set<string>
      firstScannedAt: string
      lastScannedAt: string
      latestEventId: string
      latestEventName: string
    }
  >()

  for (const scan of scans as ScanRow[]) {
    const vendorId = scan.vendor_id as string
    const scannedAt = scan.scanned_at as string
    const event = Array.isArray(scan.event) ? scan.event[0] : scan.event
    const eventId = (event?.id as string | undefined) ?? (scan.event_id as string)
    const eventName = (event?.name as string | undefined) ?? 'Market'

    const existing = byVendor.get(vendorId)
    if (!existing) {
      byVendor.set(vendorId, {
        scanCount: 1,
        eventIds: new Set([eventId]),
        firstScannedAt: scannedAt,
        lastScannedAt: scannedAt,
        latestEventId: eventId,
        latestEventName: eventName,
      })
      continue
    }

    existing.scanCount += 1
    existing.eventIds.add(eventId)
    if (scannedAt < existing.firstScannedAt) existing.firstScannedAt = scannedAt
    if (scannedAt > existing.lastScannedAt) {
      existing.lastScannedAt = scannedAt
      existing.latestEventId = eventId
      existing.latestEventName = eventName
    }
  }

  const vendorIds = [...byVendor.keys()]
  const { data: passports } = await supabase
    .from('vendor_passports')
    .select(`
      user_id,
      business_name,
      bio,
      logo_url,
      website_url,
      shop_url,
      instagram_url,
      primary_category:categories(name)
    `)
    .in('user_id', vendorIds)

  type PassportRow = NonNullable<typeof passports>[number]
  const passportByVendor = new Map<string, PassportRow>()
  for (const passport of passports ?? []) {
    passportByVendor.set(passport.user_id as string, passport)
  }

  return vendorIds
    .map((vendorId) => {
      const aggregate = byVendor.get(vendorId)!
      const passport = passportByVendor.get(vendorId)
      const category = Array.isArray(passport?.primary_category)
        ? passport?.primary_category[0]
        : passport?.primary_category

      return {
        vendorId,
        businessName: (passport?.business_name as string | undefined) ?? 'Vendor',
        logoUrl: (passport?.logo_url as string | null | undefined) ?? null,
        categoryName: (category?.name as string | undefined) ?? null,
        bio: (passport?.bio as string | null | undefined) ?? null,
        websiteUrl: (passport?.website_url as string | null | undefined) ?? null,
        shopUrl: (passport?.shop_url as string | null | undefined) ?? null,
        instagramUrl: (passport?.instagram_url as string | null | undefined) ?? null,
        scanCount: aggregate.scanCount,
        marketCount: aggregate.eventIds.size,
        firstScannedAt: aggregate.firstScannedAt,
        lastScannedAt: aggregate.lastScannedAt,
        latestEventId: aggregate.latestEventId,
        latestEventName: aggregate.latestEventName,
        profileHref: buildVendorProfileHref(aggregate.latestEventId, vendorId),
      }
    })
    .sort((a, b) => b.lastScannedAt.localeCompare(a.lastScannedAt))
}
