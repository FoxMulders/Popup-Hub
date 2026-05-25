/** Shared booth_applications select for coordinator event views. */
export const COORDINATOR_APPLICATION_SELECT = `
  *,
  vendor:profiles!booth_applications_vendor_id_fkey(
    id,
    full_name,
    email,
    phone,
    avatar_url,
    reliability_score,
    no_show_count,
    left_early_count,
    late_arrival_count,
    poor_cleanup_strike_count,
    total_markets,
    passport:vendor_passports(
      business_name,
      bio,
      logo_url,
      item_image_urls,
      is_verified,
      tax_id_encrypted,
      primary_category_id,
      category_ids,
      website_url,
      shop_url,
      instagram_url
    )
  ),
  category:categories(name)
` as const
