import { autoLayout } from '@/lib/booth-planner/algorithm'
import {
  createFakeVendors,
  TEST_CATEGORY_PRESETS,
  type FakeVendorInput,
} from '@/lib/booth-planner/fake-vendors'
import type { LayoutPreset } from '@/lib/booth-planner/layout-presets'
import { tableFootprintToGridSpans } from '@/lib/booth-planner/table-space'
import { buildOutsideOnlyVenueElements } from '@/lib/booth-planner/outside-only-layout'
import { buildOutdoorMarketShell } from '@/lib/booth-planner/outdoor-market-shell'
import { buildDefaultVenueElements, blockedCellKeys } from '@/lib/booth-planner/venue-elements'
import type { BoothCell, VenueElement } from '@/types/database'
import type { LayoutSpacingMode } from '@/lib/booth-planner/table-space'

export interface TestLayoutFillParams {
  venueWidth: number
  venueLength: number
  boothWidth: number
  boothLength: number
  entrance: 'north' | 'south' | 'east' | 'west'
  spacingMode: LayoutSpacingMode
  preset?: LayoutPreset
  categoryNames: string[]
  categoryColor: (name: string) => string
}

export interface CategoryFillCount {
  categoryName: string
  count: number
}

export interface TestLayoutFillResult {
  fakeVendors: FakeVendorInput[]
  venueElements: VenueElement[]
  cells: BoothCell[]
  estimatedCapacity: number
  selectedCount: number
  placedCount: number
  perCategory: CategoryFillCount[]
}

interface ProbeVendor {
  id: string
  vendorName: string
  categoryName: string
  categoryColor: string
  colSpan: number
  rowSpan: number
  tableLengthFt: number | null
}

function probeVendor(
  index: number,
  categoryName: string,
  categoryColor: (name: string) => string,
  spacingMode: LayoutSpacingMode
): ProbeVendor {
  const tableLengthFt = spacingMode === 'table_provided' ? 6 : null
  const spans =
    spacingMode === 'table_provided'
      ? tableFootprintToGridSpans(tableLengthFt!)
      : { colSpan: 1, rowSpan: 1 }
  return {
    id: `probe-${index}`,
    vendorName: `Probe ${index + 1}`,
    categoryName,
    categoryColor: categoryColor(categoryName),
    colSpan: spans.colSpan,
    rowSpan: spans.rowSpan,
    tableLengthFt,
  }
}

function venueElementsForPreset(
  preset: LayoutPreset | undefined,
  cols: number,
  rows: number,
  entrance: TestLayoutFillParams['entrance']
): VenueElement[] {
  if (preset === 'perimeter') {
    return buildOutsideOnlyVenueElements(cols, rows, entrance)
  }
  if (preset === 'outdoor') {
    return buildOutdoorMarketShell({ cols, rows, entrance })
  }
  return buildDefaultVenueElements(entrance, cols, rows)
}

/** Max vendors that auto-layout can place with current aisles and stroller spacing. */
export function estimateMaxVendorsFit(params: TestLayoutFillParams): number {
  const cols = Math.max(1, Math.floor(params.venueWidth / params.boothWidth))
  const rows = Math.max(1, Math.floor(params.venueLength / params.boothLength))
  const venueElements = venueElementsForPreset(params.preset, cols, rows, params.entrance)
  const blocked = blockedCellKeys(venueElements)
  const openCells = cols * rows - blocked.size
  if (openCells <= 0) return 0

  let lo = 0
  let hi = Math.min(openCells, 120)

  const category = params.categoryNames[0] ?? 'Uncategorized'

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const vendors = Array.from({ length: mid }, (_, i) =>
      probeVendor(i, category, params.categoryColor, params.spacingMode)
    )
    const { cells } = autoLayout({
      venueWidth: params.venueWidth,
      venueLength: params.venueLength,
      boothWidth: params.boothWidth,
      boothLength: params.boothLength,
      entrance: params.entrance,
      venueElements,
      vendors,
      preset: params.preset ?? 'default',
    })
    const placed = cells.filter((c) => c.col >= 0).length
    if (placed >= mid) lo = mid
    else hi = mid - 1
  }

  return lo
}

function distributeCounts(total: number, categories: string[]): CategoryFillCount[] {
  if (categories.length === 0 || total <= 0) return []
  const base = Math.floor(total / categories.length)
  let remainder = total % categories.length
  return categories.map((categoryName) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    return { categoryName, count: base + extra }
  })
}

function pickFillCategories(eventNames: string[]): string[] {
  if (eventNames.length > 0) return eventNames
  return [...TEST_CATEGORY_PRESETS].slice(0, 8)
}

/** Build test vendors, default aisles/doors, and auto-place by category up to capacity. */
export function runTestLayoutFill(params: TestLayoutFillParams): TestLayoutFillResult {
  const cols = Math.max(1, Math.floor(params.venueWidth / params.boothWidth))
  const rows = Math.max(1, Math.floor(params.venueLength / params.boothLength))
  const venueElements = venueElementsForPreset(params.preset, cols, rows, params.entrance)

  const categories = pickFillCategories(params.categoryNames)
  const estimatedCapacity = estimateMaxVendorsFit({ ...params, categoryNames: categories })
  const perCategory = distributeCounts(estimatedCapacity, categories)

  const fakeVendors: FakeVendorInput[] = []
  let index = 0
  for (const row of perCategory) {
    if (row.count <= 0) continue
    const batch = createFakeVendors(row.count, {
      namePrefix: row.categoryName,
      category: row.categoryName,
      startIndex: index,
      tableLengthFt: params.spacingMode === 'table_provided' ? 6 : undefined,
    })
    fakeVendors.push(...batch)
    index += row.count
  }

  const vendorInputs = fakeVendors.map((v) => {
    const tableLengthFt = params.spacingMode === 'table_provided' ? (v.tableLengthFt ?? 6) : null
    const spans =
      params.spacingMode === 'table_provided'
        ? tableFootprintToGridSpans(tableLengthFt!)
        : { colSpan: 1, rowSpan: 1 }
    return {
      id: v.id,
      vendorName: v.vendorName,
      categoryName: v.categoryName,
      categoryColor: params.categoryColor(v.categoryName),
      colSpan: spans.colSpan,
      rowSpan: spans.rowSpan,
      tableLengthFt,
    }
  })

  const { cells } = autoLayout({
    venueWidth: params.venueWidth,
    venueLength: params.venueLength,
    boothWidth: params.boothWidth,
    boothLength: params.boothLength,
    entrance: params.entrance,
    venueElements,
    vendors: vendorInputs,
    preset: params.preset ?? 'default',
  })

  const placedCount = cells.filter((c) => c.col >= 0).length

  return {
    fakeVendors,
    venueElements,
    cells,
    estimatedCapacity,
    selectedCount: fakeVendors.length,
    placedCount,
    perCategory,
  }
}
