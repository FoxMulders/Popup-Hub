import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'

export interface CategoryVendorMatchRow {
  categoryId: string
  categoryName: string
  openBoothCount: number
  vendors: Array<{
    vendorId: string
    businessName: string
    email: string
  }>
}

export interface OpenBoothCategoryNeed {
  categoryId: string
  categoryName: string
  openBoothCount: number
}

function vendorMatchesCategory(
  passport: { primary_category_id?: string | null; category_ids?: string[] | null },
  categoryId: string
): boolean {
  const ids = resolvePassportCategoryIds(passport)
  return ids.includes(categoryId)
}

export async function fetchCategoryVendorMatches(
  supabase: SupabaseClient,
  openCategories: OpenBoothCategoryNeed[]
): Promise<CategoryVendorMatchRow[]> {
  if (openCategories.length === 0) return []

  const { data: passports, error } = await supabase
    .from('vendor_passports')
    .select(`
      user_id,
      business_name,
      primary_category_id,
      category_ids,
      is_verified,
      account_status,
      profile:profiles!vendor_passports_user_id_fkey(email, role)
    `)
    .eq('is_verified', true)

  if (error) throw error

  const activeVendors = (passports ?? []).filter((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
    const accountStatus = (row as { account_status?: string }).account_status ?? 'active'
    return profile?.role === 'vendor' && accountStatus === 'active'
  })

  return openCategories.map((need) => {
    const vendors = activeVendors
      .filter((row) => vendorMatchesCategory(row, need.categoryId))
      .map((row) => {
        const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
        return {
          vendorId: row.user_id as string,
          businessName: (row.business_name as string)?.trim() || 'Vendor',
          email: (profile?.email as string) ?? '',
        }
      })
      .sort((a, b) => a.businessName.localeCompare(b.businessName))

    return {
      categoryId: need.categoryId,
      categoryName: need.categoryName,
      openBoothCount: need.openBoothCount,
      vendors,
    }
  })
}
