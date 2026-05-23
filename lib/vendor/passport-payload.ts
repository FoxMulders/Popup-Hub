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
  categoryIds: unknown
  logoUrl: string | null
  itemImageUrls: string[]
  taxIdEncrypted: string | null
  websiteUrl: string | null
  shopUrl: string | null
  instagramUrl: string | null
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
}

export function buildPassportSavePayload(input: PassportSaveInput): PassportSavePayload {
  const categoryIds = normalizeCategoryIds(input.categoryIds)
  if (categoryIds.length === 0) {
    throw new Error('At least one valid category is required')
  }

  return {
    user_id: input.userId,
    business_name: input.businessName.trim(),
    bio: input.bio?.trim() ?? '',
    primary_category_id: categoryIds[0],
    category_ids: categoryIds,
    logo_url: input.logoUrl,
    item_image_urls: input.itemImageUrls.slice(0, 6),
    tax_id_encrypted: input.taxIdEncrypted,
    website_url: input.websiteUrl,
    shop_url: input.shopUrl,
    instagram_url: input.instagramUrl,
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
