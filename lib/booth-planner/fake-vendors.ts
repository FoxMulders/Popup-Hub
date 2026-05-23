import type { BoothCell } from '@/types/database'
import type { VendorUnitType } from '@/lib/booth-planner/vendor-unit-types'
import type { TableOrientation } from '@/lib/booth-planner/table-orientation'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  LAYOUT_BASELINE_TABLE_LENGTHS_FT,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { TABLE_LENGTH_OPTIONS_FT } from '@/lib/booth-planner/table-space'

export const FAKE_VENDOR_ID_PREFIX = 'fake-'

export const TEST_CATEGORY_PRESETS = [
  '3D Printing',
  'Alcohol',
  'Baking & Pastries',
  'Candles & Soaps',
  'Chimes & Wind Art',
  'Epoxy Resin',
  'Fiber Arts & Yarn',
  'Food & Beverage',
  'Handmade Crafts',
  'Jewelry',
  'Laser Cutting & Engraving',
  'Pottery & Ceramics',
  'Uncategorized',
  'Vintage & Antiques',
  'Woodworking',
] as const

export interface FakeVendorInput {
  id: string
  vendorName: string
  categoryName: string
  vendorUnitType?: VendorUnitType
  tableLengthFt?: number
  tableOrientation?: TableOrientation
  /** Maps to application `requested_booth_type` for power routing. */
  requestedBoothType?: 'inside' | 'wall' | 'power' | 'any' | null
  /** Linked multi-slot vendor group (side-by-side adjacency). */
  seedGroupId?: string
  slotIndex?: number
  slotCount?: number
}

export function isFakeVendorId(id: string): boolean {
  return id.startsWith(FAKE_VENDOR_ID_PREFIX)
}

export function fakeVendorsFromCells(cells: BoothCell[]): FakeVendorInput[] {
  const seen = new Set<string>()
  const result: FakeVendorInput[] = []
  for (const cell of cells) {
    if (!isFakeVendorId(cell.id) || seen.has(cell.id)) continue
    seen.add(cell.id)
    const vendorUnitType = cell.vendorUnitType ?? 'table'
    result.push({
      id: cell.id,
      vendorName: cell.vendorName,
      categoryName: cell.categoryName,
      vendorUnitType,
      ...(vendorUnitType !== 'tent' && cell.tableLengthFt != null
        ? { tableLengthFt: cell.tableLengthFt }
        : {}),
      ...(vendorUnitType !== 'tent' && cell.tableOrientation
        ? { tableOrientation: cell.tableOrientation }
        : {}),
    })
  }
  return result
}

export function createFakeVendors(
  count: number,
  options?: {
    namePrefix?: string
    category?: string
    startIndex?: number
    tableLengthFt?: number
    vendorUnitType?: VendorUnitType
  }
): FakeVendorInput[] {
  const prefix = options?.namePrefix?.trim() || 'Test Vendor'
  const category = options?.category?.trim() || TEST_CATEGORY_PRESETS[0]
  const start = options?.startIndex ?? 0
  const unitType = options?.vendorUnitType ?? 'table'

  return Array.from({ length: count }, (_, i) => ({
    id: `${FAKE_VENDOR_ID_PREFIX}${crypto.randomUUID()}`,
    vendorName:
      unitType === 'tent'
        ? `${prefix} Tent ${start + i + 1}`
        : `${prefix} ${start + i + 1}`,
    categoryName: options?.category?.trim()
      ? category
      : TEST_CATEGORY_PRESETS[(start + i) % TEST_CATEGORY_PRESETS.length],
    vendorUnitType: unitType,
    tableLengthFt: unitType === 'tent' ? undefined : options?.tableLengthFt ?? 6,
  }))
}

export interface RandomFakeVendorFillOptions {
  /** Target registry size (venue C_max or remaining headroom). */
  count: number
  categoryNames: string[]
  allowsTentVendors?: boolean
  /** Share of tent units when outdoor rows allow them (default 0.25). */
  tentShare?: number
  tableLengthOptions?: readonly number[]
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/** Randomized mix of categories, table lengths, orientations, and optional tents. */
export function createRandomFakeVendors(options: RandomFakeVendorFillOptions): FakeVendorInput[] {
  const {
    count,
    categoryNames,
    allowsTentVendors = false,
    tentShare = 0.25,
    tableLengthOptions = TABLE_LENGTH_OPTIONS_FT,
  } = options

  if (count <= 0) return []

  const categories =
    categoryNames.length > 0 ? categoryNames : [...TEST_CATEGORY_PRESETS]

  return Array.from({ length: count }, (_, i) => {
    const category = pickRandom(categories)
    const unitType: VendorUnitType = 'table'
    const tableLengthFt = pickRandom(tableLengthOptions)

    return {
      id: `${FAKE_VENDOR_ID_PREFIX}${crypto.randomUUID()}`,
      vendorName: `${category} ${i + 1}`,
      categoryName: category,
      vendorUnitType: unitType,
      tableLengthFt,
    }
  })
}
