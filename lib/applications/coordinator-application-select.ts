/** Shared booth_applications select for coordinator event views. */
export const COORDINATOR_APPLICATION_SELECT = `
  *,
  vendor:profiles(id, full_name, email, phone, avatar_url, reliability_score),
  passport:vendor_passports(
    business_name,
    bio,
    logo_url,
    item_image_urls,
    is_verified,
    tax_id_encrypted,
    primary_category_id,
    category_ids
  ),
  category:categories(name)
` as const
