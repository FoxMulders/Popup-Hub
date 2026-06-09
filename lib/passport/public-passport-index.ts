import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category } from '@/types/database'

/** Public-safe passport fields for directory cards and external visitors. */
export type PublicPassportIndex = {
  userId: string
  businessName: string
  bio: string
  logoUrl: string | null
  websiteUrl: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
  shopUrl: string | null
  primaryCategoryId: string | null
  primaryCategoryName: string | null
  requiresElectricity: boolean
}

const PUBLIC_PASSPORT_SELECT = `
  user_id,
  business_name,
  bio,
  logo_url,
  website_url,
  instagram_url,
  facebook_url,
  tiktok_url,
  shop_url,
  primary_category_id,
  requires_electricity,
  category:categories(name)
`

export async function loadPublicPassportIndex(
  supabase: SupabaseClient,
  userId: string
): Promise<PublicPassportIndex | null> {
  const { data } = await supabase
    .from('vendor_passports')
    .select(PUBLIC_PASSPORT_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null

  const row = data as unknown as {
    user_id: string
    business_name: string
    bio: string
    logo_url: string | null
    website_url: string | null
    instagram_url: string | null
    facebook_url: string | null
    tiktok_url: string | null
    shop_url: string | null
    primary_category_id: string | null
    requires_electricity: boolean
    category?: Pick<Category, 'name'> | Pick<Category, 'name'>[] | null
  }

  const category = Array.isArray(row.category) ? row.category[0] : row.category

  return {
    userId: row.user_id,
    businessName: row.business_name?.trim() ?? '',
    bio: row.bio?.trim() ?? '',
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    tiktokUrl: row.tiktok_url,
    shopUrl: row.shop_url,
    primaryCategoryId: row.primary_category_id,
    primaryCategoryName: category?.name ?? null,
    requiresElectricity: row.requires_electricity ?? false,
  }
}
