import type { VendorVerificationStatus } from '@/types/database'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Coerce multi-select category values into a deduplicated Postgres UUID[] payload. */
export function normalizeCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const ids = raw.flatMap((item) => {
    if (typeof item === 'string' && isValidUuid(item)) return [item]
    if (item && typeof item === 'object') {
      const record = item as { value?: unknown; id?: unknown }
      if (typeof record.value === 'string' && isValidUuid(record.value)) return [record.value]
      if (typeof record.id === 'string' && isValidUuid(record.id)) return [record.id]
    }
    return []
  })

  return [...new Set(ids)]
}

export type PassportSaveInput = {
  userId: string
  businessName: string
  bio?: string
  /** Vendor primary (must be a broad category id). Falls back to categoryIds[0] for legacy callers. */
  primaryCategoryId?: string | null
  categoryIds: unknown
  logoUrl: string | null
  itemImageUrls: string[]
  taxIdEncrypted: string | null
  websiteUrl: string | null
  shopUrl: string | null
  instagramUrl: string | null
  businessNumber?: string | null
  socialHandle?: string | null
  verificationStatus?: VendorVerificationStatus | null
  riskScore?: number | null
}

export type PassportSavePayload = {
  user_id: string
  business_name: string
  bio: string
  primary_category_id: string
  category_ids: string[]
  logo_url: string | null
  item_image_urls: string[]
  tax_id_encrypted: string | null
  website_url: string | null
  shop_url: string | null
  instagram_url: string | null
  business_number: string | null
  social_handle: string | null
  verification_status: VendorVerificationStatus
  risk_score: number
}

export function buildPassportSavePayload(input: PassportSaveInput): PassportSavePayload {
  const categoryIds = normalizeCategoryIds(input.categoryIds)
  const primaryCandidate =
    typeof input.primaryCategoryId === 'string' && isValidUuid(input.primaryCategoryId)
      ? input.primaryCategoryId
      : null
  const primaryCategoryId = primaryCandidate ?? categoryIds[0]

  if (!primaryCategoryId) {
    throw new Error('A primary category is required')
  }

  const mergedCategoryIds = categoryIds.includes(primaryCategoryId)
    ? categoryIds
    : [primaryCategoryId, ...categoryIds]

  return {
    user_id: input.userId,
    business_name: input.businessName.trim(),
    bio: input.bio?.trim() ?? '',
    primary_category_id: primaryCategoryId,
    category_ids: mergedCategoryIds,
    logo_url: input.logoUrl,
    item_image_urls: input.itemImageUrls.slice(0, 6),
    tax_id_encrypted: input.taxIdEncrypted,
    website_url: input.websiteUrl,
    shop_url: input.shopUrl,
    instagram_url: input.instagramUrl,
    business_number: input.businessNumber ?? null,
    social_handle: input.socialHandle ?? null,
    verification_status: input.verificationStatus ?? 'unverified',
    risk_score: input.riskScore ?? 0,
  }
}

export function buildMinimalPassportSavePayload(input: {
  userId: string
  displayName: string
  bio?: string
}): Pick<PassportSavePayload, 'user_id' | 'business_name' | 'bio'> {
  const displayName = input.displayName.trim()
  if (!displayName) {
    throw new Error('Display name is required')
  }

  return {
    user_id: input.userId,
    business_name: displayName,
    bio: input.bio?.trim() ?? '',
  }
}

export function formatSupabaseError(error: {
  message?: string
  details?: string
  hint?: string
  code?: string
}): string {
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' — ')
}
