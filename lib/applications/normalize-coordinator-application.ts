import type { BoothApplication, Category, Profile, VendorPassport } from '@/types/database'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function normalizeCoordinatorApplication(
  record: Record<string, unknown>
): BoothApplication {
  const passportRaw = firstOrNull(record.passport as VendorPassport | VendorPassport[] | null)

  const passport = passportRaw ?? undefined

  return {
    ...(record as unknown as BoothApplication),
    vendor: firstOrNull(record.vendor as Profile | Profile[] | null) ?? undefined,
    passport,
    category: firstOrNull(record.category as Category | Category[] | null) ?? undefined,
  }
}
