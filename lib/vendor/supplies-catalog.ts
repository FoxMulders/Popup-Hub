import { buildAmazonCaAffiliateSearchUrl } from '@/lib/affiliate/amazon'

export type VendorSupplyCategory =
  | 'booth'
  | 'display'
  | 'packaging'
  | 'signage'
  | 'tools'

export interface VendorSupplyItem {
  id: string
  name: string
  description: string
  category: VendorSupplyCategory
  searchQuery: string
  affiliate_url: string
}

export const VENDOR_SUPPLY_CATEGORY_LABELS: Record<VendorSupplyCategory, string> = {
  booth: 'Booth setup',
  display: 'Display & merchandising',
  packaging: 'Packaging',
  signage: 'Signage & pricing',
  tools: 'Tools & essentials',
}

interface SupplySeed {
  id: string
  name: string
  description: string
  category: VendorSupplyCategory
  searchQuery: string
}

const SUPPLY_SEEDS: SupplySeed[] = [
  {
    id: 'canopy-tent',
    name: 'Pop-up Canopy Tent',
    description: '10×10 weather shelter for outdoor markets',
    category: 'booth',
    searchQuery: '10x10 pop up canopy tent market vendor',
  },
  {
    id: 'canopy-weights',
    name: 'Canopy Weight Bags',
    description: 'Sandbags or weights to secure your tent on windy days',
    category: 'booth',
    searchQuery: 'canopy tent weight bags sandbags',
  },
  {
    id: 'folding-table',
    name: 'Folding Display Table',
    description: 'Lightweight 6 ft table for booth layouts',
    category: 'booth',
    searchQuery: '6 foot folding table portable vendor',
  },
  {
    id: 'tablecloth',
    name: 'Fitted Tablecloth',
    description: 'Professional cover for a 6 ft folding table',
    category: 'booth',
    searchQuery: '6 foot fitted tablecloth stretch spandex',
  },
  {
    id: 'gridwall-panel',
    name: 'Gridwall Display Panel',
    description: 'Vertical grid for hanging products behind your table',
    category: 'display',
    searchQuery: 'gridwall panel display 4x4 vendor',
  },
  {
    id: 'jewelry-stand',
    name: 'Tiered Jewelry Display',
    description: 'Raised tiers for earrings, rings, and small goods',
    category: 'display',
    searchQuery: 'tiered jewelry display stand vendor',
  },
  {
    id: 'acrylic-risers',
    name: 'Acrylic Display Risers',
    description: 'Clear shelves to add height and layers on your table',
    category: 'display',
    searchQuery: 'acrylic display risers set vendor craft show',
  },
  {
    id: 'product-bags',
    name: 'Branded Kraft Shopping Bags',
    description: 'Take-away bags customers can reuse',
    category: 'packaging',
    searchQuery: 'kraft paper shopping bags with handles bulk',
  },
  {
    id: 'tissue-paper',
    name: 'Tissue Paper & Stickers',
    description: 'Wrap fragile items and seal bags neatly',
    category: 'packaging',
    searchQuery: 'tissue paper sheets gift wrap bulk stickers roll',
  },
  {
    id: 'chalkboard-sign',
    name: 'Chalkboard A-Frame Sign',
    description: 'Sidewalk sign for prices, specials, or booth name',
    category: 'signage',
    searchQuery: 'chalkboard a frame sidewalk sign vendor',
  },
  {
    id: 'price-tags',
    name: 'Price Tags & String',
    description: 'Hang tags for apparel, ceramics, and handmade goods',
    category: 'signage',
    searchQuery: 'kraft price tags with string bulk handmade',
  },
  {
    id: 'card-reader-stand',
    name: 'Phone / Card Reader Stand',
    description: 'Angled stand so customers can tap or dip easily',
    category: 'tools',
    searchQuery: 'square card reader phone stand countertop',
  },
  {
    id: 'cash-box',
    name: 'Locking Cash Box',
    description: 'Secure change drawer when you take cash at the booth',
    category: 'tools',
    searchQuery: 'locking cash box with tray vendor market',
  },
  {
    id: 'extension-cord',
    name: 'Heavy-Duty Extension Cord',
    description: 'Reach power strips when outlets are far from your booth',
    category: 'tools',
    searchQuery: 'outdoor heavy duty extension cord 25 ft',
  },
  {
    id: 'led-string-lights',
    name: 'LED String Lights',
    description: 'Warm lighting for evening markets and indoor halls',
    category: 'booth',
    searchQuery: 'warm white LED string lights plug in vendor booth',
  },
]

export const VENDOR_SUPPLY_SUGGESTIONS: VendorSupplyItem[] = SUPPLY_SEEDS.map((seed) => ({
  ...seed,
  affiliate_url: buildAmazonCaAffiliateSearchUrl(seed.searchQuery),
}))

export function filterVendorSupplies(
  items: VendorSupplyItem[],
  options: { category?: VendorSupplyCategory | 'all'; query?: string }
): VendorSupplyItem[] {
  const q = options.query?.trim().toLowerCase() ?? ''
  return items.filter((item) => {
    if (options.category && options.category !== 'all' && item.category !== options.category) {
      return false
    }
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.searchQuery.toLowerCase().includes(q)
    )
  })
}
