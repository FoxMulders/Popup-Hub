import type { VendorPassport } from '@/types/database'
import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'

export type VendorPassportApplicationPreview = Pick<
  VendorPassport,
  'id' | 'business_name' | 'logo_url' | 'primary_category_id' | 'is_verified'
> & {
  tax_id_on_file: boolean
  category_ids: string[]
  category_names: string[]
  is_beta_tester?: boolean
}

export function isPassportReadyForApplication(
  passport:
    | Pick<VendorPassport, 'business_name' | 'primary_category_id' | 'category_ids'>
    | null
    | undefined
): passport is Pick<VendorPassport, 'business_name' | 'primary_category_id' | 'category_ids'> {
  const categoryIds = resolvePassportCategoryIds(passport ?? {})
  return Boolean(passport?.business_name?.trim() && categoryIds.length > 0)
}

export function toPassportApplicationPreview(
  row: {
    id: string
    business_name: string
    logo_url: string | null
    primary_category_id: string | null
    category_ids?: string[] | null
    tax_id_encrypted: string | null
    is_verified: boolean
    category?: { name: string } | { name: string }[] | null
  },
  categoryNames: string[] = [],
  options?: { is_beta_tester?: boolean }
): VendorPassportApplicationPreview {
  const categoryIds = resolvePassportCategoryIds(row)
  const fallbackCategory = Array.isArray(row.category) ? row.category[0] : row.category
  const names =
    categoryNames.length > 0
      ? categoryNames
      : fallbackCategory?.name
        ? [fallbackCategory.name]
        : []

  return {
    id: row.id,
    business_name: row.business_name,
    logo_url: row.logo_url,
    primary_category_id: row.primary_category_id ?? categoryIds[0] ?? '',
    is_verified: row.is_verified,
    tax_id_on_file: Boolean(row.tax_id_encrypted),
    category_ids: categoryIds,
    category_names: names,
    is_beta_tester: options?.is_beta_tester ?? false,
  }
}
