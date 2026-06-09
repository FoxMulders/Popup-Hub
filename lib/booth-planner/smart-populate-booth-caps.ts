import type { Category, VenueElement } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  type CategoryBucketKey,
  classifyCategoryBucket,
} from '@/lib/categories/category-buckets'
import {
  applyMlmLimitRules,
  clampMlmMaxSlots,
  isMlmCategory,
} from '@/lib/categories/mlm-constraints'
import {
  DEFAULT_TABLE_SIZE,
  TABLE_SIZES,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/stroller-clearance'
import {
  blockedCellKeys,
  buildDefaultVenueElements,
  cellKey,
} from '@/lib/booth-planner/venue-elements'
import { TABLE_DEPTH_LEADING_FT, BOOTH_OPERATIONAL_DEPTH_FT } from '@/lib/booth-planner/table-space'

/**
 * Market unit on the 1′ grid: 2′ equipment depth + 2′ co-generated shopper aisle for C_max math.
 */
export const BOOTH_UNIT_DEPTH_FT = BOOTH_OPERATIONAL_DEPTH_FT

/** 4′ wall-to-table pocket — part of each booth footprint, not a blank perimeter band cut from gross. */
export const VENDOR_WALL_POCKET_FT = TABLE_DEPTH_LEADING_FT

export const TABLE_LENGTH_OPTIONS_FT = TABLE_SIZES
export type TableLengthOptionFt = LayoutBaselineTableLengthFt

export const DEFAULT_TABLE_LENGTH_FT: TableLengthOptionFt = DEFAULT_TABLE_SIZE

/**
 * @deprecated Perimeter blank buffer removed — perimeter rows are vendor seating.
 * Kept at 0 for callers that still read this constant.
 */
export const PERIMETER_CLEARANCE_FT = 0

/** One stroller-safe central spine aisle (matches layout planner minimum). */
export const CENTRAL_AISLE_WIDTH_FT = MIN_STROLLER_AISLE_WIDTH_FT

export const DEFAULT_UNIT_SQ_FT = DEFAULT_TABLE_LENGTH_FT * BOOTH_UNIT_DEPTH_FT // 60 at 6′ table

/**
 * Mandatory walking-aisle / fire-path reserve as a fraction of the
 * post-deduction open grid. Even after we strip perimeter walls,
 * structural locks, [E]/[X] doors, and the planned customer spine,
 * a hall still needs cross aisles for two-way patron flow plus
 * unimpeded emergency egress that aren't part of any single
 * booth's co-generated 2′ shopper aisle. We reserve **40% of the
 * remaining open grid** for that overhead before dividing into
 * booth units. This brings raw 4 000 sq ft halls down from a
 * congested 128-booth ceiling to a code-compliant ~76, in line
 * with NFPA 101 § 12.2.5.6 walking-clearance guidance.
 */
export const WALKING_AISLE_RESERVE_RATIO = 0.4

/** @deprecated superseded by WALKING_AISLE_RESERVE_RATIO. */
export const DEFAULT_WALKWAY_RESERVE_RATIO = WALKING_AISLE_RESERVE_RATIO

export interface NetUsableFloorSpaceOptions {
  venueElements?: VenueElement[]
  entrance?: 'north' | 'south' | 'east' | 'west'
}

export interface BoothUnitFootprint {
  tableLengthFt: TableLengthOptionFt
  widthFt: number
  depthFt: number
  sqFt: number
  label: string
}

export function boothUnitFootprint(tableLengthFt: TableLengthOptionFt = DEFAULT_TABLE_LENGTH_FT): BoothUnitFootprint {
  const widthFt = tableLengthFt
  const depthFt = BOOTH_UNIT_DEPTH_FT
  return {
    tableLengthFt,
    widthFt,
    depthFt,
    sqFt: widthFt * depthFt,
    label: `${widthFt}′ × ${depthFt}′ (${widthFt * depthFt} sq ft)`,
  }
}

export interface NetUsableFloorSpaceResult {
  venueWidthFt: number
  venueLengthFt: number
  grossSqFt: number
  /** Informational vendor pocket depth (4′) — not subtracted as a blank perimeter band. */
  perimeterClearanceFt: number
  centralAisleWidthFt: number
  innerWidthFt: number
  innerLengthFt: number
  netWidthFt: number
  netLengthFt: number
  netUsableSqFt: number
  /** Always 0 — perimeter wall rows are vendor seating, not an extra 8′ gross cut. */
  perimeterDeductionSqFt: number
  centralAisleDeductionSqFt: number
  walkwayReserveRatio: number
  walkwayReserveSqFt: number
  structuralNetSqFt: number
  structuralDeductionSqFt: number
  doorDeductionSqFt: number
  paintedAisleDeductionSqFt: number
  perimeterWallSqFt: number
  openGridSqFt: number
}

function elementArea(el: VenueElement): number {
  return (el.colSpan ?? 1) * (el.rowSpan ?? 1)
}

export function classifyFloorDeductions(elements: VenueElement[]): {
  structuralSqFt: number
  doorSqFt: number
  paintedAisleSqFt: number
  perimeterWallSqFt: number
} {
  let structuralSqFt = 0
  let doorSqFt = 0
  let paintedAisleSqFt = 0
  let perimeterWallSqFt = 0

  for (const el of elements) {
    const area = elementArea(el)
    if (el.type === 'column') {
      perimeterWallSqFt += area
    } else if (el.type === 'entrance' || el.type === 'exit') {
      doorSqFt += area
    } else if (el.type === 'aisle') {
      paintedAisleSqFt += area
    } else if (el.locked || el.type === 'stage') {
      structuralSqFt += area
    }
  }

  return { structuralSqFt, doorSqFt, paintedAisleSqFt, perimeterWallSqFt }
}

/** Reserve one 8′ customer spine aisle (open cells only). */
function reserveCentralAisleCells(cols: number, rows: number, blocked: Set<string>): number {
  if (cols <= 0 || rows <= 0) return 0
  const aisleW = Math.min(CENTRAL_AISLE_WIDTH_FT, cols)
  const startCol = Math.max(0, Math.floor((cols - aisleW) / 2))
  let reserved = 0
  for (let r = 0; r < rows; r++) {
    for (let c = startCol; c < startCol + aisleW; c++) {
      if (!blocked.has(cellKey(r, c))) reserved++
    }
  }
  return reserved
}

/**
 * Net usable vendor floor on the 1′ grid.
 * Perimeter wall rows count as vendor seating (4′ pocket in booth depth) — no blank 8′ gross buffer.
 * Deducts only fixed locks, [E]/[X] openings, painted aisles, and one planned 8′ customer spine.
 */
export function calculateNetUsableFloorSpace(
  venueWidthFt: number,
  venueLengthFt: number,
  options?: NetUsableFloorSpaceOptions
): NetUsableFloorSpaceResult {
  const cols = Math.max(0, Math.floor(venueWidthFt))
  const rows = Math.max(0, Math.floor(venueLengthFt))
  const grossSqFt = cols * rows
  const entrance = options?.entrance ?? 'south'
  const elements =
    options?.venueElements ??
    (cols > 0 && rows > 0 ? buildDefaultVenueElements(entrance, cols, rows) : [])

  const blocked = blockedCellKeys(elements, cols, rows)
  const deductions = classifyFloorDeductions(elements)
  const centralAisleDeductionSqFt = reserveCentralAisleCells(cols, rows, blocked)
  const openGridSqFt = Math.max(0, grossSqFt - blocked.size)
  const postDeductionSqFt = Math.max(0, openGridSqFt - centralAisleDeductionSqFt)
  /*
   * Reserve a 40% slice of whatever open grid remains for cross
   * aisles, fire-egress lanes, and emergency exit paths. The
   * per-booth 2′ co-generated shopper aisle (already baked into
   * BOOTH_OPERATIONAL_DEPTH_FT) only handles row-local foot
   * traffic; coordinators still need bigger thoroughfares for
   * stroller-pair flow and code-compliant egress, and those don't
   * exist as explicit cells in the doc.
   */
  const walkwayReserveSqFt = Math.round(
    postDeductionSqFt * WALKING_AISLE_RESERVE_RATIO
  )
  const netUsableSqFt = Math.max(0, postDeductionSqFt - walkwayReserveSqFt)

  const netWidthFt = Math.max(0, venueWidthFt - CENTRAL_AISLE_WIDTH_FT)
  const netLengthFt = venueLengthFt

  return {
    venueWidthFt,
    venueLengthFt,
    grossSqFt,
    perimeterClearanceFt: VENDOR_WALL_POCKET_FT,
    centralAisleWidthFt: CENTRAL_AISLE_WIDTH_FT,
    innerWidthFt: venueWidthFt,
    innerLengthFt: venueLengthFt,
    netWidthFt,
    netLengthFt,
    netUsableSqFt,
    perimeterDeductionSqFt: 0,
    centralAisleDeductionSqFt,
    walkwayReserveRatio: WALKING_AISLE_RESERVE_RATIO,
    walkwayReserveSqFt,
    structuralNetSqFt: netUsableSqFt,
    structuralDeductionSqFt: deductions.structuralSqFt,
    doorDeductionSqFt: deductions.doorSqFt,
    paintedAisleDeductionSqFt: deductions.paintedAisleSqFt,
    perimeterWallSqFt: deductions.perimeterWallSqFt,
    openGridSqFt,
  }
}

/** Maximum vendor booths C_max = net usable ÷ unit footprint. */
export function calculateMaxBoothCapacity(
  netUsableSqFt: number,
  unitSqFt: number
): number {
  if (unitSqFt <= 0) return 0
  return Math.max(0, Math.floor(netUsableSqFt / unitSqFt))
}

export type DistributionBucketKey = CategoryBucketKey

/** @deprecated Use classifyCategoryBucket from `@/lib/categories/category-buckets`. */
export const classifyCategory = classifyCategoryBucket

export interface CategoryDistributionBucket {
  key: DistributionBucketKey
  label: string
  share: number
}

/** Target mix for auto-populated booth caps. */
export const CATEGORY_DISTRIBUTION_BUCKETS: CategoryDistributionBucket[] = [
  { key: 'makers', label: 'Makers', share: 0.5 },
  { key: 'art', label: 'Art', share: 0.15 },
  { key: 'food', label: 'Food', share: 0.15 },
  { key: 'apparel', label: 'Apparel', share: 0.1 },
  { key: 'commercial', label: 'Commercial / MLMs', share: 0.1 },
]

export interface BucketSlotAllocation {
  key: DistributionBucketKey
  label: string
  share: number
  targetSlots: number
  categoryCount: number
}

export interface SmartPopulateBreakdown {
  footprint: BoothUnitFootprint
  floor: NetUsableFloorSpaceResult
  cMax: number
  totalAllocated: number
  buckets: BucketSlotAllocation[]
}

function allocateBucketTargets(cMax: number): Map<DistributionBucketKey, number> {
  const targets = new Map<DistributionBucketKey, number>()
  let assigned = 0
  const keys = CATEGORY_DISTRIBUTION_BUCKETS.map((b) => b.key)

  for (let i = 0; i < CATEGORY_DISTRIBUTION_BUCKETS.length; i++) {
    const bucket = CATEGORY_DISTRIBUTION_BUCKETS[i]
    const isLast = i === CATEGORY_DISTRIBUTION_BUCKETS.length - 1
    const slots = isLast
      ? Math.max(0, cMax - assigned)
      : Math.floor(cMax * bucket.share)
    targets.set(bucket.key, slots)
    assigned += slots
  }

  // Rounding safety: remainder to makers
  if (assigned < cMax) {
    targets.set('makers', (targets.get('makers') ?? 0) + (cMax - assigned))
  } else if (assigned > cMax) {
    let over = assigned - cMax
    for (const key of ['commercial', 'apparel', 'food', 'art', 'makers'] as DistributionBucketKey[]) {
      if (over <= 0) break
      const cur = targets.get(key) ?? 0
      const take = Math.min(cur, over)
      targets.set(key, cur - take)
      over -= take
    }
  }

  return targets
}

function splitSlotsAcrossCategories(count: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(count / n)
  let remainder = count % n
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    return base + extra
  })
}

export interface BuildSmartPopulateLimitsInput {
  venueWidthFt: number
  venueLengthFt: number
  tableLengthFt?: TableLengthOptionFt
  categories: Category[]
  allowMlm: boolean
  /** Preserve booth fees / table length from existing rows when category already configured. */
  existingLimits?: CategoryLimit[]
  venueElements?: VenueElement[]
  entrance?: 'north' | 'south' | 'east' | 'west'
  /** Collective cap on total MLM booth slots (FCFS waitlist beyond cap). */
  globalMlmCap?: number
}

export interface BuildSmartPopulateLimitsResult {
  limits: CategoryLimit[]
  breakdown: SmartPopulateBreakdown
}

/**
 * Compute C_max from room dimensions and distribute across categories per market mix.
 */
export function buildSmartPopulateLimits(
  input: BuildSmartPopulateLimitsInput
): BuildSmartPopulateLimitsResult {
  const tableLengthFt = input.tableLengthFt ?? DEFAULT_TABLE_LENGTH_FT
  const footprint = boothUnitFootprint(tableLengthFt)
  const floor = calculateNetUsableFloorSpace(input.venueWidthFt, input.venueLengthFt, {
    venueElements: input.venueElements,
    entrance: input.entrance,
  })
  const cMax = calculateMaxBoothCapacity(floor.netUsableSqFt, footprint.sqFt)

  const eligible = input.categories.filter((c) => input.allowMlm || !c.is_mlm)
  const byBucket = new Map<DistributionBucketKey, Category[]>()
  for (const key of CATEGORY_DISTRIBUTION_BUCKETS.map((b) => b.key)) {
    byBucket.set(key, [])
  }
  for (const cat of eligible) {
    const bucket = classifyCategoryBucket(cat, input.allowMlm)
    byBucket.get(bucket)!.push(cat)
  }

  const bucketTargets = allocateBucketTargets(cMax)
  const existingById = new Map(
    (input.existingLimits ?? []).map((l) => [l.categoryId, l])
  )

  const limits: CategoryLimit[] = []
  const bucketSummaries: BucketSlotAllocation[] = []

  for (const bucket of CATEGORY_DISTRIBUTION_BUCKETS) {
    const cats = [...(byBucket.get(bucket.key) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    const target = bucketTargets.get(bucket.key) ?? 0
    bucketSummaries.push({
      key: bucket.key,
      label: bucket.label,
      share: bucket.share,
      targetSlots: target,
      categoryCount: cats.length,
    })

    if (cats.length === 0 || target === 0) continue

    const perCat = splitSlotsAcrossCategories(target, cats.length)
    cats.forEach((cat, i) => {
      let slots = perCat[i] ?? 0
      if (slots <= 0) return
      if (bucket.key === 'commercial' && isMlmCategory(cat)) {
        slots = clampMlmMaxSlots(cat.name, cat, slots)
      }
      const prev = existingById.get(cat.id)
      limits.push({
        categoryId: cat.id,
        categoryName: cat.name,
        maxSlots: slots,
        pricePerBooth: prev?.pricePerBooth ?? 0,
        tableLengthFt: prev?.tableLengthFt ?? tableLengthFt,
      })
    })
  }

  const cappedLimits =
    input.globalMlmCap != null
      ? applyMlmLimitRules(limits, eligible, input.globalMlmCap)
      : applyMlmLimitRules(limits, eligible, Number.MAX_SAFE_INTEGER)

  cappedLimits.sort((a, b) => a.categoryName.localeCompare(b.categoryName))

  return {
    limits: cappedLimits,
    breakdown: {
      footprint,
      floor,
      cMax,
      totalAllocated: cappedLimits.reduce((s, l) => s + l.maxSlots, 0),
      buckets: bucketSummaries,
    },
  }
}
