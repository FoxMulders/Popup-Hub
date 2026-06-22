import {
  appendAmazonAssociateTag,
  buildAmazonCaAffiliateSearchUrl,
} from '@/lib/affiliate/amazon'

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
  /** Chronological booth-setup priority (lower = earlier in the "All" view). */
  setupOrder: number
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
  setupOrder: number
  searchQuery: string
  /** Direct Amazon.ca product or brand-store URL (associate tag appended at build time). */
  directAffiliateUrl?: string
}

const SQUARE_READER_AMAZON_URL =
  'https://www.amazon.ca/stores/SquareInc/page/F882F6F2-F8DA-4218-8C31-F66F9B86AD6D?lp_asin=B0D7WF2KWW&ref_=ast_bln&store_ref=bl_ast_dp_brandlogo_sto'

/** Booth setup flow: POS → shelter → power → merchandising → signage → takeaway. */
const SUPPLY_SEEDS: SupplySeed[] = [
  // Phase 0: Point of sale
  {
    id: 'square-reader',
    name: 'Square Reader',
    description: 'Tap, chip, and contactless payments at your booth — official Square hardware on Amazon.ca',
    category: 'tools',
    setupOrder: 1,
    searchQuery: 'square reader tap to pay contactless',
    directAffiliateUrl: SQUARE_READER_AMAZON_URL,
  },
  // Phase 1: Shelter & foundation
  {
    id: 'canopy-tent',
    name: 'Pop-up Canopy Tent',
    description: '10×10 weather shelter for outdoor markets',
    category: 'booth',
    setupOrder: 2,
    searchQuery: '10x10 pop up canopy tent market vendor',
  },
  {
    id: 'canopy-weights',
    name: 'Canopy Weight Bags',
    description: 'Sandbags or weights to secure your tent on windy days',
    category: 'booth',
    setupOrder: 3,
    searchQuery: 'canopy tent weight bags sandbags',
  },
  {
    id: 'folding-table',
    name: 'Folding Display Table',
    description: 'Lightweight 6 ft table for booth layouts',
    category: 'booth',
    setupOrder: 4,
    searchQuery: '6 foot folding table portable vendor',
  },
  {
    id: 'tablecloth',
    name: 'Fitted Tablecloth',
    description: 'Professional cover for a 6 ft folding table',
    category: 'booth',
    setupOrder: 5,
    searchQuery: '6 foot fitted tablecloth stretch spandex',
  },
  // Phase 2: Lighting & power
  {
    id: 'extension-cord',
    name: 'Heavy-Duty Extension Cord',
    description: 'Reach power strips when outlets are far from your booth',
    category: 'tools',
    setupOrder: 6,
    searchQuery: 'outdoor heavy duty extension cord 25 ft',
  },
  {
    id: 'led-string-lights',
    name: 'LED String Lights',
    description: 'Warm lighting for evening markets and indoor halls',
    category: 'booth',
    setupOrder: 7,
    searchQuery: 'warm white LED string lights plug in vendor booth',
  },
  // Phase 3: Merchandising & shelving
  {
    id: 'gridwall-panel',
    name: 'Gridwall Display Panel',
    description: 'Vertical grid for hanging products behind your table',
    category: 'display',
    setupOrder: 8,
    searchQuery: 'gridwall panel display 4x4 vendor',
  },
  {
    id: 'acrylic-risers',
    name: 'Acrylic Display Risers',
    description: 'Clear shelves to add height and layers on your table',
    category: 'display',
    setupOrder: 9,
    searchQuery: 'acrylic display risers set vendor craft show',
  },
  {
    id: 'jewelry-stand',
    name: 'Tiered Jewelry Display',
    description: 'Raised tiers for earrings, rings, and small goods',
    category: 'display',
    setupOrder: 10,
    searchQuery: 'tiered jewelry display stand vendor',
  },
  // Phase 4: Signage & checkout accessories
  {
    id: 'chalkboard-sign',
    name: 'Chalkboard A-Frame Sign',
    description: 'Sidewalk sign for prices, specials, or booth name',
    category: 'signage',
    setupOrder: 11,
    searchQuery: 'chalkboard a frame sidewalk sign vendor',
  },
  {
    id: 'price-tags',
    name: 'Price Tags & String',
    description: 'Hang tags for apparel, ceramics, and handmade goods',
    category: 'signage',
    setupOrder: 12,
    searchQuery: 'kraft price tags with string bulk handmade',
  },
  {
    id: 'card-reader-stand',
    name: 'Phone / Card Reader Stand',
    description: 'Angled stand so customers can tap or dip easily',
    category: 'tools',
    setupOrder: 13,
    searchQuery: 'square card reader phone stand countertop',
  },
  {
    id: 'cash-box',
    name: 'Locking Cash Box',
    description: 'Secure change drawer when you take cash at the booth',
    category: 'tools',
    setupOrder: 14,
    searchQuery: 'locking cash box with tray vendor market',
  },
  // Phase 5: Customer takeaway
  {
    id: 'product-bags',
    name: 'Branded Kraft Shopping Bags',
    description: 'Take-away bags customers can reuse',
    category: 'packaging',
    setupOrder: 15,
    searchQuery: 'kraft paper shopping bags with handles bulk',
  },
  {
    id: 'tissue-paper',
    name: 'Tissue Paper & Stickers',
    description: 'Wrap fragile items and seal bags neatly',
    category: 'packaging',
    setupOrder: 16,
    searchQuery: 'tissue paper sheets gift wrap bulk stickers roll',
  },
]

export const VENDOR_SUPPLY_SUGGESTIONS: VendorSupplyItem[] = SUPPLY_SEEDS.map(
  ({ directAffiliateUrl, ...seed }) => ({
    ...seed,
    affiliate_url: directAffiliateUrl
      ? appendAmazonAssociateTag(directAffiliateUrl)
      : buildAmazonCaAffiliateSearchUrl(seed.searchQuery),
  })
)

export function filterVendorSupplies(
  items: VendorSupplyItem[],
  options: { category?: VendorSupplyCategory | 'all'; query?: string }
): VendorSupplyItem[] {
  const q = options.query?.trim().toLowerCase() ?? ''
  const filtered = items.filter((item) => {
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

  return [...filtered].sort((a, b) => a.setupOrder - b.setupOrder)
}
