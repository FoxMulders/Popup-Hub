import type { BoothApplication, Category, Profile, VendorPassport } from '@/types/database'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function normalizeCoordinatorApplication(
  record: Record<string, unknown>
): BoothApplication {
  const vendorRaw = firstOrNull(record.vendor as (Profile & { passport?: VendorPassport | VendorPassport[] | null }) | (Profile & { passport?: VendorPassport | VendorPassport[] | null })[] | null)
  const passportFromVendor = vendorRaw?.passport
  const passportRaw =
    firstOrNull(record.passport as VendorPassport | VendorPassport[] | null) ??
    firstOrNull(passportFromVendor ?? null)

  const passport = passportRaw ?? undefined
  const vendor = vendorRaw
    ? ({
        ...vendorRaw,
        passport: undefined,
      } as Profile)
    : undefined

  return {
    ...(record as unknown as BoothApplication),
    vendor,
    passport,
    category: firstOrNull(record.category as Category | Category[] | null) ?? undefined,
  }
}
