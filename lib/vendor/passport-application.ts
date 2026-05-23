import type { VendorPassport } from '@/types/database'

export type VendorPassportApplicationPreview = Pick<
  VendorPassport,
  'id' | 'business_name' | 'logo_url' | 'primary_category_id' | 'is_verified'
> & {
  tax_id_on_file: boolean
  category_name: string | null
}

export function isPassportReadyForApplication(
  passport: Pick<VendorPassport, 'business_name' | 'primary_category_id'> | null | undefined
): passport is Pick<VendorPassport, 'business_name' | 'primary_category_id'> {
  return Boolean(passport?.business_name?.trim() && passport.primary_category_id)
}

export function toPassportApplicationPreview(row: {
  id: string
  business_name: string
  logo_url: string | null
  primary_category_id: string
  tax_id_encrypted: string | null
  is_verified: boolean
  category?: { name: string } | { name: string }[] | null
}): VendorPassportApplicationPreview {
  const category = Array.isArray(row.category) ? row.category[0] : row.category

  return {
    id: row.id,
    business_name: row.business_name,
    logo_url: row.logo_url,
    primary_category_id: row.primary_category_id,
    is_verified: row.is_verified,
    tax_id_on_file: Boolean(row.tax_id_encrypted),
    category_name: category?.name ?? null,
  }
}
