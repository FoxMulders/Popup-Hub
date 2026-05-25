import type { VendorPassport } from '@/types/database'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** Passport may be nested under vendor (PostgREST) or top-level on legacy rows. */
export function extractNestedPassport(row: Record<string, unknown>): VendorPassport | null {
  const vendor = firstOrNull(row.vendor as Record<string, unknown> | Record<string, unknown>[] | null)
  const nested = vendor?.passport
  if (nested != null) return firstOrNull(nested as VendorPassport | VendorPassport[] | null)
  return firstOrNull((row.passport ?? null) as VendorPassport | VendorPassport[] | null)
}
