import type { BoothApplication, Category } from '@/types/database'

export interface VendorLineupEntry extends BoothApplication {
  displayName: string
}

export function buildVendorLineup(applications: BoothApplication[]): VendorLineupEntry[] {
  return applications.map((app) => ({
    ...app,
    displayName:
      app.passport?.business_name ?? app.vendor?.full_name ?? 'Vendor',
  }))
}

export function filterVendorsByCategory(
  vendors: VendorLineupEntry[],
  categoryId: string | null
): VendorLineupEntry[] {
  if (!categoryId) return vendors
  return vendors.filter((v) => v.category_id === categoryId)
}

export function filterVendorsBySearch(
  vendors: VendorLineupEntry[],
  query: string
): VendorLineupEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return vendors
  return vendors.filter((v) => {
    const name = v.displayName.toLowerCase()
    const cat = v.category?.name?.toLowerCase() ?? ''
    const bio = v.passport?.bio?.toLowerCase() ?? ''
    return name.includes(q) || cat.includes(q) || bio.includes(q)
  })
}

export function getCategoryChips(
  vendors: VendorLineupEntry[]
): { id: string; name: string; count: number }[] {
  const map = new Map<string, { id: string; name: string; count: number }>()
  for (const v of vendors) {
    const id = v.category_id
    const name = v.category?.name ?? 'Other'
    const existing = map.get(id)
    if (existing) existing.count += 1
    else map.set(id, { id, name, count: 1 })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function getTopCategoryNames(vendors: VendorLineupEntry[], limit = 3): string[] {
  return getCategoryChips(vendors)
    .slice(0, limit)
    .map((c) => c.name)
}

export type VendorLinkField = 'website_url' | 'shop_url' | 'instagram_url'

export interface VendorLink {
  field: VendorLinkField
  label: string
  url: string
}

export function getVendorLinks(passport: {
  website_url?: string | null
  shop_url?: string | null
  instagram_url?: string | null
} | null | undefined): VendorLink[] {
  if (!passport) return []
  const links: VendorLink[] = []
  if (passport.website_url) {
    links.push({ field: 'website_url', label: 'Website', url: passport.website_url })
  }
  if (passport.shop_url) {
    links.push({ field: 'shop_url', label: 'Shop', url: passport.shop_url })
  }
  if (passport.instagram_url) {
    links.push({ field: 'instagram_url', label: 'Instagram', url: passport.instagram_url })
  }
  return links
}
