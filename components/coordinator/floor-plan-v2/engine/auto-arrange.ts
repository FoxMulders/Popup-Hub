/**
 * Auto-Arrange engine — deterministic grid, staggered, and perimeter modes.
 *
 * Modes (see `lib/floor-plan/deterministic-market-layout.ts`):
 *   - `grid` — aligned rows/columns, 8′ aisles, entrance-first row order.
 *   - `staggered` — alternating half-width row offset for patron sightlines.
 *   - `perimeter-only` — boundary loop (top→right→bottom→left).
 *
 * Legacy alias `center-out` maps to `grid`.
 *
 * Honors structural obstacles (restricted zones), multi-table consolidation,
 * same-category proximity when slots remain after deterministic placement,
 * and keeps guest/patron seating tables separate from vendor booth layout.
 */

import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '../state/types'
import {
  collisionProbeForObject,
  placedObjectsOverlap,
  rotatedAabb,
} from '../interactions/geometry'
import { objectFootprintAabb } from '../state/table-cluster-layout'
import {
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
} from '../interactions/category-rules'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  consolidateBoothsForAutoArrange,
  type VendorTableMeta,
} from '@/lib/booth-planner/table-booth-consolidation'
import {
  autoArrangeModeToMarketLayout,
  DEFAULT_AISLE_WIDTH_FT,
  generateDeterministicMarketLayout,
  TABLE_EDGE_GAP_FT,
} from '@/lib/floor-plan/deterministic-market-layout'
import {
  BOOTH_CORE_SEPARATION_CELLS,
  BOOTH_SAFETY_BUFFER_FT,
  PATRON_AISLE_MIN_FT,
} from '@/lib/booth-planner/layout-clearance-constants'

export {
  calculatePatronCentricLayout,
  type PatronCentricLayoutResult,
  type PatronLayoutObjectInput,
  type PatronCentricLayoutOptions,
  PATRON_CORRIDOR_WIDTH_FT,
  PATRON_VISION_CONE_DEG,
} from './patron-centric-layout'

export {
  computeMarketLayout,
  generateDeterministicMarketLayout,
  maxPerimeterTableCapacity,
  placementsToJson,
  type DeterministicMarketLayoutInput,
  type DeterministicMarketLayoutResult,
  type MarketLayoutMode,
  type MarketLayoutPlacementJson,
  type MarketLayoutRequest,
  type MarketLayoutTablePlacement,
  DEFAULT_AISLE_WIDTH_FT,
} from '@/lib/floor-plan/deterministic-market-layout'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import { clipBoothToLocalRoom } from '@/lib/floor-plan/boundary-constraints'
import {
  boothSpanAndDepth,
  orientBoothForPerimeterSlot,
  perimeterSlotsAlongRing,
  rotationForPerimeterEdge,
  type PerimeterSlot,
} from '../interactions/perimeter-booth-orientation'
import {
  pointInsidePlacementSurface,
  resolveRoomPlacementSurface,
  type PlacementRing,
} from '../state/placement-surface'

/** Standard chair = 1.75 ft on a side. */
export const CHAIR_LENGTH_FT = 1.75
/** Two patrons walking shoulder-to-shoulder ≈ 5 ft. */
export const PATRON_PAIR_WIDTH_FT = 5
/** Wall to back of vendor booth — patron aisle minimum at perimeter. */
export const GRID_WALL_INSET_FT = PATRON_AISLE_MIN_FT
/** Back-to-back island gap (2 chairs back-to-back + 1 walking buffer). */
export const BACK_TO_BACK_GAP_FT = CHAIR_LENGTH_FT * 3
/** Wall to back of vendor booth (2 chairs) — non-grid modes. */
export const WALL_BUFFER_FT = CHAIR_LENGTH_FT * 2
/** Front-of-booth clearance — uses the patron-pair width. */
export const FRONT_CLEARANCE_FT = PATRON_PAIR_WIDTH_FT
/**
 * Edge-to-edge gap between adjacent vendor booth footprints in grid / row pack.
 * Two booths side-by-side share a 2′ buffer each → 4′ between table edges.
 * Row pack advances X by `boothW + BOOTH_PLACEMENT_GAP_FT`.
 */
export const BOOTH_PLACEMENT_GAP_FT = BOOTH_CORE_SEPARATION_CELLS
/** Per-side clearance around fixed vendor/patron footprints treated as obstacles. */
export const BOOTH_OBSTACLE_CLEARANCE_FT = BOOTH_SAFETY_BUFFER_FT
/** Column gap between patron tables during row-pack fallback (unchanged from grid default). */
const PATRON_TABLE_GAP_FT = TABLE_EDGE_GAP_FT
/** @deprecated Use {@link BOOTH_PLACEMENT_GAP_FT} for vendor-vendor spacing; {@link BOOTH_OBSTACLE_CLEARANCE_FT} for cross-group obstacles. */
export const BOOTH_EDGE_CLEARANCE_FT = BOOTH_PLACEMENT_GAP_FT
/** Padding added around manually placed patron tables before auto-arrange. */
export const PATRON_BOUNDING_BOX_PADDING_FT = 1
/** Shown when patron auto-arrange cannot fit all tables inside the active box. */
export const PATRON_ARRANGE_DENSITY_ERROR =
  'Could not automatically adjust tables. Manual placement is required to fit this density.'

export type AutoArrangeMode = 'grid' | 'staggered' | 'perimeter-only'

/** @deprecated Use `grid` — kept for persisted UI / old URLs. */
export type AutoArrangeModeLegacy = AutoArrangeMode | 'center-out'

function normalizeAutoArrangeMode(
  mode: AutoArrangeModeLegacy | undefined
): AutoArrangeMode {
  if (mode === 'center-out' || mode == null) return 'grid'
  return mode
}

/** Which booth categories participate in a pass — vendor, patron, or both. */
export type AutoArrangeScope = 'all' | 'vendor' | 'patron'

export interface AutoArrangeOptions {
  /** Which units to rearrange — defaults to both vendor and patron passes. */
  scope?: AutoArrangeScope
  /** Placement strategy — defaults to aligned grid. */
  mode?: AutoArrangeModeLegacy
  /** Aisle width between rows / along perimeter (ft). Default 8. */
  aisleWidthFt?: number
  /** Venue baseline table length for multi-table consolidation. */
  baselineTableLengthFt?: LayoutBaselineTableLengthFt
  /** Per-vendor table counts from approved applications. */
  vendorTableMetaByKey?: Map<string, VendorTableMeta>
  /**
   * Sorted list of category names (Step 2). Drives the diversification
   * pass; if empty, booths are left untagged.
   */
  eventCategoryNames?: ReadonlyArray<string>
  /**
   * Hard structural cap from the Step 2 capacity calculation
   * (`calculateMaxBoothCapacity` after the walking-aisle reserve).
   * The engine will never lay out more than this many booths even
   * if the caller passes a doc with a larger booth count — the
   * overflow is reported via `overflowCount` so the UI can warn
   * the coordinator that they're over the safe ceiling.
   */
  maxBooths?: number
  /**
   * When set, perimeter-only mode walks this union ring instead of the
   * rectangular canvas bounds (post-merge / joined zones).
   */
  placementOuterRing?: PlacementRing
  /** Local origin for `placementOuterRing` (defaults to 0,0). */
  placementOrigin?: { x: number; y: number }
}

export interface AutoArrangeResult {
  /** New doc with the booth list re-positioned. Other objects untouched. */
  doc: FloorPlanDoc
  /** How many booths the engine successfully re-placed. */
  placedCount: number
  /** How many booths the engine had to drop (couldn't fit at any rotation). */
  droppedCount: number
  /**
   * How many booths landed without an assigned category because every
   * candidate would have violated the same-category proximity rule
   * (`< 4 columns AND < 2 rows`) against an already-placed booth.
   * The caller should surface a warning when this is non-zero so the
   * coordinator knows their canvas is too tight to host every category.
   */
  unsatisfiedCategoryCount: number
  /**
   * How many booths the caller asked for that were NOT laid out
   * because they exceeded `options.maxBooths`. These are dropped
   * before the physical clearance pass — they never even get a
   * shot at a slot. Distinct from `droppedCount`, which means
   * "wanted to place but the canvas had no room".
   */
  overflowCount: number
  /**
   * Booths that could not be placed without overlapping and were omitted
   * from the canvas (safe-fit overflow).
   */
  removedOverlapCount: number
  /** Set when perimeter-only mode cannot fit all booths on the boundary. */
  perimeterCapacityError?: string
  /** Human-readable summary of the deterministic layout pass. */
  layoutExplanation?: string
  /**
   * Set when patron auto-arrange aborts to preserve manual placement
   * (tables could not fit equidistantly inside the active bounding box).
   */
  patronArrangeAborted?: string
}

export interface AutoArrangeInRoomResult extends AutoArrangeResult {
  /** Room frame the pass ran inside. */
  roomId: string
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** True when two booth rects are closer than `clearanceFt` edge-to-edge. */
function boothsCloserThan(
  a: Rect,
  b: Rect,
  clearanceFt: number
): boolean {
  const m = clearanceFt
  return aabbOverlap(
    {
      x: a.x - m,
      y: a.y - m,
      width: a.width + m * 2,
      height: a.height + m * 2,
    },
    b
  )
}

/**
 * Build a list of obstacle AABBs from the doc — anything that booths
 * must not overlap (walls, doors, emergency exits, stages, labels are
 * treated as walk-around obstacles).
 *
 */
function obstacleRectsFor(doc: FloorPlanDoc): Rect[] {
  const out: Rect[] = []
  for (const obj of doc.objects) {
    if (obj.kind === 'booth' || obj.kind === 'merged_zone') continue
    out.push(rotatedAabb(obj))
  }
  return out
}

/** Fixed booth footprints (patron or vendor) as no-go zones with edge clearance. */
function boothFootprintObstacleRects(
  booths: BoothObject[],
  doc?: FloorPlanDoc,
  clearanceFt = BOOTH_OBSTACLE_CLEARANCE_FT
): Rect[] {
  const ctx = doc
    ? {
        canvasWidthFt: doc.canvasWidthFt,
        canvasLengthFt: doc.canvasLengthFt,
        gridSpacingFt: doc.gridSpacingFt,
        snapFt: doc.snapFt,
        objects: doc.objects,
        rooms: doc.rooms ?? [],
        objectRoom: doc.objectRoom,
      }
    : undefined
  return booths.map((b) => {
    if (!isGuestTableBooth(b)) {
      return rotatedAabb(collisionProbeForObject(b, ctx))
    }
    return expandRectForClearance(objectFootprintAabb(b), clearanceFt)
  })
}

type Slot = { x: number; y: number; dist?: number; perimeter?: PerimeterSlot }

interface PlacementContext {
  cw: number
  cl: number
  boothW: number
  boothH: number
  obstacles: Rect[]
  sourceBooths: BoothObject[]
  eventCategoryNames?: ReadonlyArray<string>
  gridSpacingFt: number
  wallInsetFt: number
  /** When true, booths may sit flush on perimeter edges (perimeter-only mode). */
  allowPerimeterEdgeFlush?: boolean
  /** When set, perimeter slots orient booths against this frame. */
  perimeterOrientFrame?: RoomFrame
  overlapDoc?: FloorPlanDoc
}

function placeBoothsAtSlots(
  slots: Slot[],
  ctx: PlacementContext
): {
  newBooths: BoothObject[]
  placedRects: Rect[]
  unsatisfiedCategoryCount: number
} {
  const {
    cw,
    cl,
    boothW,
    boothH,
    obstacles,
    sourceBooths,
    eventCategoryNames,
    gridSpacingFt,
    wallInsetFt,
    allowPerimeterEdgeFlush = false,
    perimeterOrientFrame,
    overlapDoc,
  } = ctx
  const overlapCtx = overlapDoc
    ? {
        canvasWidthFt: overlapDoc.canvasWidthFt,
        canvasLengthFt: overlapDoc.canvasLengthFt,
        gridSpacingFt: overlapDoc.gridSpacingFt,
        snapFt: overlapDoc.snapFt,
        objects: overlapDoc.objects,
        rooms: overlapDoc.rooms ?? [],
        objectRoom: overlapDoc.objectRoom,
      }
    : undefined
  const placedRects: Rect[] = []
  const newBooths: BoothObject[] = []
  let nextSourceIdx = 0
  let categoryRotor = 0
  const categoryCount = eventCategoryNames?.length ?? 0
  const categoryUseCount = new Map<string, number>()
  if (eventCategoryNames) {
    for (const name of eventCategoryNames) categoryUseCount.set(name, 0)
  }
  let unsatisfiedCategoryCount = 0

  function violatesProximity(rect: Rect, category: string | null): boolean {
    if (!category) return false
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    for (let i = 0; i < newBooths.length; i++) {
      const placed = newBooths[i]!
      if ((placed.categoryName ?? null) !== category) continue
      const placedRect = placedRects[i]!
      const ocx = placedRect.x + placedRect.width / 2
      const ocy = placedRect.y + placedRect.height / 2
      const dxColumns = Math.abs(cx - ocx) / gridSpacingFt
      const dyRows = Math.abs(cy - ocy) / gridSpacingFt
      if (
        dxColumns < PROXIMITY_MIN_COLUMNS &&
        dyRows < PROXIMITY_MIN_ROWS
      ) {
        return true
      }
    }
    return false
  }

  function pickCategoryForSlot(rect: Rect): {
    category: string | null
    advanceBy: number
  } {
    if (categoryCount === 0) return { category: null, advanceBy: 0 }
    const candidates: Array<{ name: string; rotorIdx: number }> = []
    for (let i = 0; i < categoryCount; i++) {
      const idx = (categoryRotor + i) % categoryCount
      candidates.push({ name: eventCategoryNames![idx]!, rotorIdx: i })
    }
    candidates.sort((a, b) => {
      const ua = categoryUseCount.get(a.name) ?? 0
      const ub = categoryUseCount.get(b.name) ?? 0
      if (ua !== ub) return ua - ub
      return a.rotorIdx - b.rotorIdx
    })
    for (const cand of candidates) {
      if (!violatesProximity(rect, cand.name)) {
        return { category: cand.name, advanceBy: cand.rotorIdx + 1 }
      }
    }
    return { category: null, advanceBy: 1 }
  }

  function candidateFits(candidate: Rect, probeBooth: BoothObject): boolean {
    const placedRect = rotatedAabb(probeBooth)
    if (placedRect.x + placedRect.width > cw + 1e-6 || placedRect.y + placedRect.height > cl + 1e-6) {
      return false
    }
    if (placedRect.x < -1e-6 || placedRect.y < -1e-6) {
      return false
    }
    if (!allowPerimeterEdgeFlush) {
      if (
        placedRect.x < wallInsetFt - 1e-6 ||
        placedRect.y < wallInsetFt - 1e-6 ||
        placedRect.x + placedRect.width > cw - wallInsetFt + 1e-6 ||
        placedRect.y + placedRect.height > cl - wallInsetFt + 1e-6
      ) {
        return false
      }
    }
    const obstacleProbe = expandRectForClearance(placedRect, BOOTH_OBSTACLE_CLEARANCE_FT)
    if (obstacles.some((r) => aabbOverlap(obstacleProbe, r))) return false
    for (const placed of newBooths) {
      if (placedObjectsOverlap(probeBooth, placed, overlapCtx)) return false
    }
    return true
  }

  function placeAtSlot(slot: Slot): boolean {
    if (nextSourceIdx >= sourceBooths.length) return false
    const src = sourceBooths[nextSourceIdx]!
    const w = roundHalf(src.width)
    const h = roundHalf(src.height)
    const candidate: Rect = {
      x: slot.x,
      y: slot.y,
      width: w,
      height: h,
    }
    let probeBooth: BoothObject = {
      ...src,
      x: candidate.x,
      y: candidate.y,
      width: w,
      height: h,
      rotation: 0,
    }
    if (slot.perimeter?.direct) {
      const { span, depth } = boothSpanAndDepth(w, h, src.tableLengthFt)
      probeBooth = {
        ...probeBooth,
        x: slot.perimeter.x,
        y: slot.perimeter.y,
        width: span,
        height: depth,
        rotation: rotationForPerimeterEdge(slot.perimeter.edge),
      }
    } else if (slot.perimeter && perimeterOrientFrame) {
      probeBooth = orientBoothForPerimeterSlot(
        probeBooth,
        slot.perimeter,
        w,
        h,
        perimeterOrientFrame
      )
    }
    if (!candidateFits(candidate, probeBooth)) return false

    nextSourceIdx++
    const { category, advanceBy } = pickCategoryForSlot(candidate)
    if (categoryCount > 0) {
      categoryRotor = (categoryRotor + advanceBy) % categoryCount
    }
    if (category) {
      categoryUseCount.set(category, (categoryUseCount.get(category) ?? 0) + 1)
    } else if (categoryCount > 0) {
      unsatisfiedCategoryCount++
    }
    const finalCategory =
      categoryCount > 0 ? category : src.categoryName ?? null
    const placed: BoothObject = {
      ...probeBooth,
      categoryName: finalCategory,
    }
    const placedRect = rotatedAabb(placed)
    newBooths.push(placed)
    placedRects.push(placedRect)
    return true
  }

  for (const slot of slots) {
    if (nextSourceIdx >= sourceBooths.length) break
    placeAtSlot(slot)
  }

  return { newBooths, placedRects, unsatisfiedCategoryCount }
}

/**
 * Run auto-arrange in the selected mode (grid, staggered, or perimeter-only).
 */
function restrictedZonesFromObstacles(obstacles: Rect[]): Array<{
  x: number
  y: number
  width: number
  height: number
}> {
  return obstacles.map((r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }))
}

/** True when a booth can stay put after a failed reposition attempt. */
function boothOriginalPositionUsable(
  booth: BoothObject,
  cw: number,
  cl: number,
  obstacles: Rect[],
  wallInsetFt = WALL_BUFFER_FT
): boolean {
  const rect = objectFootprintAabb(booth)
  if (
    rect.x < wallInsetFt - 1e-6 ||
    rect.y < wallInsetFt - 1e-6 ||
    rect.x + rect.width > cw - wallInsetFt + 1e-6 ||
    rect.y + rect.height > cl - wallInsetFt + 1e-6
  ) {
    return false
  }
  return !obstacles.some((o) => aabbOverlap(rect, o))
}

function boothOverlapsPlaced(
  booth: BoothObject,
  placed: BoothObject[],
  overlapDoc?: FloorPlanDoc
): boolean {
  if (placed.length === 0) return false
  const overlapCtx = overlapDoc
    ? {
        canvasWidthFt: overlapDoc.canvasWidthFt,
        canvasLengthFt: overlapDoc.canvasLengthFt,
        gridSpacingFt: overlapDoc.gridSpacingFt,
        snapFt: overlapDoc.snapFt,
        objects: overlapDoc.objects,
        rooms: overlapDoc.rooms ?? [],
        objectRoom: overlapDoc.objectRoom,
      }
    : undefined
  return placed.some((p) => placedObjectsOverlap(booth, p, overlapCtx))
}

function findStagingPosition(
  booth: BoothObject,
  placedRects: Rect[],
  placedBooths: BoothObject[],
  cw: number,
  cl: number,
  wallInsetFt: number,
  obstacles: Rect[],
  overlapDoc?: FloorPlanDoc
): { x: number; y: number } | null {
  const w = booth.width
  const h = booth.height
  const pitchX = w + BOOTH_PLACEMENT_GAP_FT
  const pitchY = h + BOOTH_PLACEMENT_GAP_FT
  const overlapCtx = overlapDoc
    ? {
        canvasWidthFt: overlapDoc.canvasWidthFt,
        canvasLengthFt: overlapDoc.canvasLengthFt,
        gridSpacingFt: overlapDoc.gridSpacingFt,
        snapFt: overlapDoc.snapFt,
        objects: overlapDoc.objects,
        rooms: overlapDoc.rooms ?? [],
        objectRoom: overlapDoc.objectRoom,
      }
    : undefined

  function slotIsFree(x: number, y: number): boolean {
    const rect: Rect = { x: roundHalf(x), y: roundHalf(y), width: w, height: h }
    if (
      rect.x < wallInsetFt - 1e-6 ||
      rect.y < wallInsetFt - 1e-6 ||
      rect.x + rect.width > cw - wallInsetFt + 1e-6 ||
      rect.y + rect.height > cl - wallInsetFt + 1e-6
    ) {
      return false
    }
    if (obstacles.some((o) => aabbOverlap(rect, o))) return false
    if (placedRects.some((r) => aabbOverlap(rect, r))) return false
    const probe: BoothObject = { ...booth, x: rect.x, y: rect.y, rotation: 0 }
    if (placedBooths.some((p) => placedObjectsOverlap(probe, p, overlapCtx))) {
      return false
    }
    return true
  }

  for (
    let y = wallInsetFt;
    y + h <= cl - wallInsetFt + 1e-6;
    y += pitchY
  ) {
    for (
      let x = wallInsetFt;
      x + w <= cw - wallInsetFt + 1e-6;
      x += pitchX
    ) {
      if (slotIsFree(x, y)) return { x: roundHalf(x), y: roundHalf(y) }
    }
  }
  return null
}

function retainUnplacedVendorBooths(
  sourceBooths: BoothObject[],
  placed: BoothObject[],
  cw: number,
  cl: number,
  obstacles: Rect[],
  wallInsetFt: number,
  overlapDoc?: FloorPlanDoc
): { merged: BoothObject[]; unmovedCount: number; removedCount: number } {
  const placedIds = new Set(placed.map((b) => b.id))
  const placedRects = placed.map((b) => rotatedAabb(b))
  const retained: BoothObject[] = []
  let removedCount = 0

  for (const booth of sourceBooths) {
    if (placedIds.has(booth.id)) continue

    const overlapsPlaced = boothOverlapsPlaced(booth, placed, overlapDoc)
    if (
      !overlapsPlaced &&
      boothOriginalPositionUsable(booth, cw, cl, obstacles, wallInsetFt)
    ) {
      retained.push(booth)
      placedRects.push(rotatedAabb(booth))
      continue
    }

    const staged = findStagingPosition(
      booth,
      placedRects,
      [...placed, ...retained],
      cw,
      cl,
      wallInsetFt,
      obstacles,
      overlapDoc
    )
    if (staged) {
      const stagedBooth: BoothObject = {
        ...booth,
        x: staged.x,
        y: staged.y,
        rotation: 0,
      }
      retained.push(stagedBooth)
      placedRects.push(rotatedAabb(stagedBooth))
    } else {
      removedCount++
    }
  }

  return {
    merged: [...placed, ...retained],
    unmovedCount: sourceBooths.length - placed.length,
    removedCount,
  }
}

const PERIMETER_ROW_TO_EDGE: Record<
  number,
  import('../interactions/perimeter-booth-orientation').RoomEdgeSide
> = {
  0: 'top',
  1: 'right',
  2: 'bottom',
  3: 'left',
}

interface VendorAutoArrangePassResult {
  newVendorBooths: BoothObject[]
  vendorDroppedCount: number
  unsatisfiedCategoryCount: number
  overflowCount: number
  removedOverlapCount: number
  perimeterCapacityError?: string
  layoutExplanation?: string
}

interface GuestAutoArrangePassResult {
  placed: BoothObject[]
  dropped: BoothObject[]
  /** True when layout aborted — `placed` holds originals unchanged. */
  aborted?: boolean
}

function boothCenter(b: Pick<BoothObject, 'x' | 'y' | 'width' | 'height'>): {
  x: number
  y: number
} {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

function sortGuestTablesByPlacement(booths: BoothObject[]): BoothObject[] {
  return [...booths].sort((a, b) => {
    const ac = boothCenter(a)
    const bc = boothCenter(b)
    if (Math.abs(ac.y - bc.y) > 0.01) return ac.y - bc.y
    return ac.x - bc.x
  })
}

function rectOverlapsAny(rect: Rect, rects: Rect[], clearanceFt = 0): boolean {
  const padded =
    clearanceFt > 0 ? expandRectForClearance(rect, clearanceFt) : rect
  return rects.some((other) => aabbOverlap(padded, other))
}

function guestTableFits(
  rect: Rect,
  cw: number,
  cl: number,
  wallInsetFt: number,
  obstacles: Rect[],
  vendorRects: Rect[],
  placedRects: Rect[],
  region?: Rect | null
): boolean {
  if (region) {
    if (
      rect.x < region.x - 1e-6 ||
      rect.y < region.y - 1e-6 ||
      rect.x + rect.width > region.x + region.width + 1e-6 ||
      rect.y + rect.height > region.y + region.height + 1e-6
    ) {
      return false
    }
  } else if (
    rect.x < wallInsetFt - 1e-6 ||
    rect.y < wallInsetFt - 1e-6 ||
    rect.x + rect.width > cw - wallInsetFt + 1e-6 ||
    rect.y + rect.height > cl - wallInsetFt + 1e-6
  ) {
    return false
  }
  if (rectOverlapsAny(rect, obstacles, BOOTH_OBSTACLE_CLEARANCE_FT)) return false
  if (rectOverlapsAny(rect, vendorRects, BOOTH_OBSTACLE_CLEARANCE_FT)) return false
  if (rectOverlapsAny(rect, placedRects, PATRON_TABLE_GAP_FT)) return false
  return true
}

function guestPlacementBounds(booths: BoothObject[]): Rect | null {
  if (booths.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of booths) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Imaginary sub-box around existing patron tables plus perimeter padding. */
export function guestActiveBoundingBox(
  booths: BoothObject[],
  paddingFt = PATRON_BOUNDING_BOX_PADDING_FT
): Rect | null {
  const bounds = guestPlacementBounds(booths)
  if (!bounds) return null
  return {
    x: bounds.x - paddingFt,
    y: bounds.y - paddingFt,
    width: bounds.width + paddingFt * 2,
    height: bounds.height + paddingFt * 2,
  }
}

function filterSlotsWithinRegion(
  slots: Array<{ x: number; y: number }>,
  region: Rect,
  maxTableW: number,
  maxTableH: number
): Array<{ x: number; y: number }> {
  return slots.filter(
    (slot) =>
      slot.x >= region.x - 1e-6 &&
      slot.y >= region.y - 1e-6 &&
      slot.x + maxTableW <= region.x + region.width + 1e-6 &&
      slot.y + maxTableH <= region.y + region.height + 1e-6
  )
}

/** Prefer the area guest tables were drawn in; fall back to room center or open space away from vendors. */
function guestPackOrigins(
  cw: number,
  cl: number,
  wallInsetFt: number,
  guestBooths: BoothObject[],
  vendorRects: Rect[]
): Array<{ x: number; y: number }> {
  const origins: Array<{ x: number; y: number }> = []
  const bounds = guestPlacementBounds(guestBooths)
  if (bounds) {
    origins.push({ x: bounds.x, y: bounds.y })
    origins.push({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    })
  }
  origins.push({ x: cw / 2, y: cl / 2 })
  origins.push({ x: wallInsetFt + 2, y: wallInsetFt + 2 })
  origins.push({
    x: Math.max(wallInsetFt, cw / 2 - 12),
    y: Math.max(wallInsetFt, cl / 2 - 12),
  })

  const scored = origins.map((origin) => {
    let minDist = Infinity
    for (const vr of vendorRects) {
      const vcx = vr.x + vr.width / 2
      const vcy = vr.y + vr.height / 2
      minDist = Math.min(minDist, Math.hypot(origin.x - vcx, origin.y - vcy))
    }
    if (vendorRects.length === 0) minDist = Infinity
    const overlapsVendor = vendorRects.some((vr) =>
      aabbOverlap(
        expandRectForClearance(
          { x: origin.x, y: origin.y, width: 1, height: 1 },
          BOOTH_OBSTACLE_CLEARANCE_FT
        ),
        vr
      )
    )
    return { origin, score: minDist - (overlapsVendor ? 1000 : 0) }
  })
  scored.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const unique: Array<{ x: number; y: number }> = []
  for (const { origin } of scored) {
    const key = `${roundHalf(origin.x)},${roundHalf(origin.y)}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(origin)
  }
  return unique
}

function preserveGuestTableFootprint(booth: BoothObject): BoothObject {
  const w = roundHalf(booth.width)
  const h = roundHalf(booth.height)
  const isRound =
    booth.tableShape === 'round' ||
    (Math.abs(w - h) < 0.01 && booth.tableShape !== 'rectangular')
  const diameter = isRound ? Math.max(w, h) : null
  return {
    ...booth,
    width: diameter ?? w,
    height: diameter ?? h,
    rotation: 0,
    tablePurpose: 'guest',
    tableShape: isRound ? 'round' : booth.tableShape ?? 'rectangular',
  }
}

function retainUnplacedGuestTables(
  sourceBooths: BoothObject[],
  placed: BoothObject[],
  cw: number,
  cl: number,
  wallInsetFt: number,
  obstacles: Rect[],
  vendorRects: Rect[],
  region?: Rect | null
): { merged: BoothObject[]; unmovedCount: number } {
  const placedIds = new Set(placed.map((b) => b.id))
  const placedRects = placed.map((b) => objectFootprintAabb(b))
  const retained = sourceBooths.filter((b) => {
    if (placedIds.has(b.id)) return false
    const rect = objectFootprintAabb(b)
    return guestTableFits(
      rect,
      cw,
      cl,
      wallInsetFt,
      obstacles,
      vendorRects,
      placedRects,
      region
    )
  })
  return {
    merged: [...placed, ...retained],
    unmovedCount: sourceBooths.length - placed.length,
  }
}

function medianGuestTableDimension(values: number[]): number {
  if (values.length === 0) return 6
  const sorted = [...values].sort((a, b) => a - b)
  return roundHalf(sorted[Math.floor(sorted.length / 2)] ?? 6)
}

function tryPlaceGuestAtSlots(
  sorted: BoothObject[],
  slots: Array<{ x: number; y: number }>,
  ctx: {
    cw: number
    cl: number
    wallInsetFt: number
    obstacles: Rect[]
    vendorRects: Rect[]
    region?: Rect | null
  }
): GuestAutoArrangePassResult {
  const placed: BoothObject[] = []
  const placedRects: Rect[] = []
  const remaining = [...sorted]

  for (const slot of slots) {
    if (remaining.length === 0) break
    let matchIdx = -1
    for (let i = 0; i < remaining.length; i++) {
      const src = remaining[i]!
      const candidate: Rect = {
        x: slot.x,
        y: slot.y,
        width: src.width,
        height: src.height,
      }
      if (
        guestTableFits(
          candidate,
          ctx.cw,
          ctx.cl,
          ctx.wallInsetFt,
          ctx.obstacles,
          ctx.vendorRects,
          placedRects,
          ctx.region
        )
      ) {
        const item: BoothObject = {
          ...src,
          x: candidate.x,
          y: candidate.y,
          width: src.width,
          height: src.height,
          rotation: 0,
        }
        placed.push(item)
        placedRects.push(objectFootprintAabb(item))
        matchIdx = i
        break
      }
    }
    if (matchIdx >= 0) {
      remaining.splice(matchIdx, 1)
    }
  }

  return { placed, dropped: remaining }
}

function arrangeGuestTablesDeterministic(
  guestBooths: BoothObject[],
  ctx: {
    cw: number
    cl: number
    obstacles: Rect[]
    vendorRects: Rect[]
    wallInsetFt: number
    mode: AutoArrangeMode
    aisleWidthFt: number
    snapFt: number
    localRing: PlacementRing | null
    activeBoundingBox?: Rect | null
  }
): GuestAutoArrangePassResult | null {
  const sorted = sortGuestTablesByPlacement(
    guestBooths.map(preserveGuestTableFootprint)
  )
  const tableW = medianGuestTableDimension(sorted.map((b) => b.width))
  const tableH = medianGuestTableDimension(sorted.map((b) => b.height))
  const maxTableW = Math.max(tableW, ...sorted.map((b) => b.width))
  const maxTableH = Math.max(tableH, ...sorted.map((b) => b.height))
  const region = ctx.activeBoundingBox ?? null
  const layoutW = region?.width ?? ctx.cw
  const layoutH = region?.height ?? ctx.cl
  const layoutWallInset = region ? 0 : ctx.wallInsetFt
  const slotCtx = { ...ctx, region }
  const restrictedZones = restrictedZonesFromObstacles([
    ...ctx.obstacles,
    ...ctx.vendorRects.map((r) =>
      expandRectForClearance(r, BOOTH_OBSTACLE_CLEARANCE_FT)
    ),
  ])

  if (ctx.mode === 'perimeter-only' && ctx.localRing && !region) {
    const perimeterSlots = perimeterSlotsAlongRing(
      ctx.localRing,
      tableW,
      tableH
    ).map((p) => ({ x: p.x, y: p.y }))
    if (perimeterSlots.length === 0) return null
    const attempt = tryPlaceGuestAtSlots(sorted, perimeterSlots, slotCtx)
    if (attempt.dropped.length === 0) return attempt
    return null
  }

  const layoutMode = autoArrangeModeToMarketLayout(ctx.mode)
  const deterministic = generateDeterministicMarketLayout({
    marketWidthFt: layoutW,
    marketHeightFt: layoutH,
    tableWidthFt: tableW,
    tableHeightFt: tableH,
    tableCount: sorted.length,
    tableIds: sorted.map((b) => b.id),
    layoutMode,
    aisleWidthFt: ctx.aisleWidthFt,
    wallInsetFt: layoutWallInset,
    snapFt: ctx.snapFt,
    restrictedZones,
  })

  if (!deterministic.ok) return null

  const slotCandidates =
    deterministic.layoutSlotCandidates ??
    deterministic.placements.map((place) => ({
      x: place.x,
      y: place.y,
    }))
  const originX = region?.x ?? 0
  const originY = region?.y ?? 0
  const rawSlots = slotCandidates.map((place) => ({
    x: place.x + originX,
    y: place.y + originY,
  }))
  const slots = region
    ? filterSlotsWithinRegion(rawSlots, region, maxTableW, maxTableH)
    : rawSlots
  if (slots.length < sorted.length) return null
  const attempt = tryPlaceGuestAtSlots(sorted, slots, slotCtx)
  if (attempt.dropped.length === 0) return attempt
  return null
}

function abortGuestArrange(sorted: BoothObject[]): GuestAutoArrangePassResult {
  return { placed: sorted, dropped: [], aborted: true }
}

function finalizeGuestArrange(
  sorted: BoothObject[],
  result: GuestAutoArrangePassResult,
  ctx: {
    cw: number
    cl: number
    wallInsetFt: number
    obstacles: Rect[]
    vendorRects: Rect[]
    region?: Rect | null
    requireFullPlacement: boolean
  }
): GuestAutoArrangePassResult {
  if (ctx.requireFullPlacement && result.dropped.length > 0) {
    return abortGuestArrange(sorted)
  }
  const { merged } = retainUnplacedGuestTables(
    sorted,
    result.placed,
    ctx.cw,
    ctx.cl,
    ctx.wallInsetFt,
    ctx.obstacles,
    ctx.vendorRects,
    ctx.region
  )
  const mergedIds = new Set(merged.map((b) => b.id))
  const dropped = sorted.filter((b) => !mergedIds.has(b.id))
  if (ctx.requireFullPlacement && dropped.length > 0) {
    return abortGuestArrange(sorted)
  }
  return { placed: merged, dropped }
}

/**
 * Pack patron / guest tables separately from vendor booths — preserves
 * each table's laid size (round tables stay circular) and sorts them
 * near where they were placed or in open space away from vendor units.
 *
 * When `activeBoundingBox` is set (patron-only pass), layout is confined
 * to that imaginary sub-box and aborts non-destructively if every table
 * cannot be rearranged inside it.
 */
export function arrangeGuestTables(
  guestBooths: BoothObject[],
  ctx: {
    cw: number
    cl: number
    obstacles: Rect[]
    vendorRects: Rect[]
    wallInsetFt?: number
    mode?: AutoArrangeMode
    aisleWidthFt?: number
    snapFt?: number
    localRing?: PlacementRing | null
    /** Localized perimeter around existing patron tables (patron scope). */
    activeBoundingBox?: Rect | null
  }
): GuestAutoArrangePassResult {
  if (guestBooths.length === 0) {
    return { placed: [], dropped: [] }
  }

  const wallInsetFt = ctx.wallInsetFt ?? WALL_BUFFER_FT
  const mode = ctx.mode ?? 'grid'
  const aisleWidthFt = ctx.aisleWidthFt ?? DEFAULT_AISLE_WIDTH_FT
  const snapFt = ctx.snapFt ?? 0.5
  const localRing = ctx.localRing ?? null
  const region = ctx.activeBoundingBox ?? null
  const requireFullPlacement = region != null
  const sorted = sortGuestTablesByPlacement(
    guestBooths.map(preserveGuestTableFootprint)
  )
  const finalizeCtx = {
    cw: ctx.cw,
    cl: ctx.cl,
    wallInsetFt,
    obstacles: ctx.obstacles,
    vendorRects: ctx.vendorRects,
    region,
    requireFullPlacement,
  }

  const deterministic = arrangeGuestTablesDeterministic(sorted, {
    cw: ctx.cw,
    cl: ctx.cl,
    obstacles: ctx.obstacles,
    vendorRects: ctx.vendorRects,
    wallInsetFt,
    mode,
    aisleWidthFt,
    snapFt,
    localRing,
    activeBoundingBox: region,
  })
  if (deterministic) {
    return finalizeGuestArrange(sorted, deterministic, finalizeCtx)
  }

  const origins = region
    ? [
        { x: region.x, y: region.y },
        {
          x: region.x + region.width / 2,
          y: region.y + region.height / 2,
        },
      ]
    : guestPackOrigins(
        ctx.cw,
        ctx.cl,
        wallInsetFt,
        sorted,
        ctx.vendorRects
      )

  for (const anchor of origins) {
    const placed: BoothObject[] = []
    const placedRects: Rect[] = []
    const dropped: BoothObject[] = []
    let rowX = anchor.x
    let rowY = anchor.y
    let rowMaxH = 0
    const rowStartX = anchor.x
    const maxRowWidth = region?.width ?? ctx.cw - wallInsetFt * 2
    const rowEndX = region ? region.x + region.width : anchor.x + maxRowWidth

    for (const src of sorted) {
      let placedOne = false
      let attempts = 0
      while (!placedOne && attempts < sorted.length + 4) {
        attempts++
        const candidate: Rect = {
          x: rowX,
          y: rowY,
          width: src.width,
          height: src.height,
        }

        const rowOverflow =
          candidate.x + candidate.width > rowEndX + 1e-6 &&
          candidate.x > rowStartX + 1e-6

        if (rowOverflow) {
          rowX = rowStartX
          rowY += rowMaxH + PATRON_TABLE_GAP_FT
          rowMaxH = 0
          continue
        }

        if (
          guestTableFits(
            candidate,
            ctx.cw,
            ctx.cl,
            wallInsetFt,
            ctx.obstacles,
            ctx.vendorRects,
            placedRects,
            region
          )
        ) {
          const item: BoothObject = {
            ...src,
            x: candidate.x,
            y: candidate.y,
            width: src.width,
            height: src.height,
            rotation: 0,
          }
          placed.push(item)
          placedRects.push(objectFootprintAabb(item))
          rowX += src.width + PATRON_TABLE_GAP_FT
          rowMaxH = Math.max(rowMaxH, src.height)
          placedOne = true
          continue
        }

        rowX = rowStartX
        rowY += (rowMaxH || src.height) + PATRON_TABLE_GAP_FT
        rowMaxH = 0
      }

      if (!placedOne) {
        dropped.push(src)
      }
    }

    if (dropped.length === 0) {
      return finalizeGuestArrange(
        sorted,
        { placed, dropped: [] },
        finalizeCtx
      )
    }
  }

  if (requireFullPlacement) {
    return abortGuestArrange(sorted)
  }

  const { merged } = retainUnplacedGuestTables(
    sorted,
    [],
    ctx.cw,
    ctx.cl,
    wallInsetFt,
    ctx.obstacles,
    ctx.vendorRects,
    region
  )
  const mergedIds = new Set(merged.map((b) => b.id))
  return {
    placed: merged,
    dropped: sorted.filter((b) => !mergedIds.has(b.id)),
  }
}

function autoArrangeVendorBooths(
  doc: FloorPlanDoc,
  sourceBooths: BoothObject[],
  options: {
    mode: AutoArrangeMode
    eventCategoryNames?: ReadonlyArray<string>
    aisleWidthFt: number
    overflowCount: number
    placementOrigin: { x: number; y: number }
    localRing: PlacementRing | null
    otherObjects: PlacedObject[]
    obstacles: Rect[]
  }
): VendorAutoArrangePassResult {
  const {
    mode,
    eventCategoryNames,
    aisleWidthFt,
    overflowCount,
    localRing,
    otherObjects,
    obstacles,
  } = options

  if (sourceBooths.length === 0) {
    return {
      newVendorBooths: [],
      vendorDroppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount,
      removedOverlapCount: 0,
    }
  }

  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const gridSpacingFt = doc.gridSpacingFt > 0 ? doc.gridSpacingFt : 1
  const snapFt = doc.snapFt > 0 ? doc.snapFt : 0.5
  const wallInsetFt =
    mode === 'grid' || mode === 'staggered'
      ? GRID_WALL_INSET_FT
      : WALL_BUFFER_FT

  const placementCtx = {
    cw,
    cl,
    boothW: roundHalf(
      [...sourceBooths.map((b) => b.width)].sort((a, b) => a - b)[
        Math.floor(sourceBooths.length / 2)
      ] ?? 6
    ),
    boothH: roundHalf(
      [...sourceBooths.map((b) => b.height)].sort((a, b) => a - b)[
        Math.floor(sourceBooths.length / 2)
      ] ?? 5
    ),
    obstacles,
    sourceBooths,
    eventCategoryNames,
    gridSpacingFt,
    wallInsetFt,
    overlapDoc: doc,
  }

  const widths = [...sourceBooths.map((b) => b.width)].sort((a, b) => a - b)
  const heights = [...sourceBooths.map((b) => b.height)].sort((a, b) => a - b)
  const boothW = placementCtx.boothW
  const boothH = placementCtx.boothH

  const doors = otherObjects.filter((o) => o.kind === 'door')
  const entranceDoor =
    doors.find((d) => d.kind === 'door' && d.doorType === 'entrance') ??
    doors[0]
  const entrance = entranceDoor
    ? {
        x: entranceDoor.x + entranceDoor.width / 2,
        y: entranceDoor.y + entranceDoor.height / 2,
      }
    : undefined

  if (mode === 'perimeter-only' && localRing) {
    const perimeterSlots = perimeterSlotsAlongRing(localRing, boothW, boothH).map(
      (p) => ({ x: p.x, y: p.y, perimeter: p })
    )
    const perimeterOrientFrame: RoomFrame = {
      id: '__auto_arrange_canvas__',
      name: 'Canvas',
      originX: 0,
      originY: 0,
      widthFt: cw,
      lengthFt: cl,
    }
    if (perimeterSlots.length === 0) {
      return {
        newVendorBooths: sourceBooths,
        vendorDroppedCount: sourceBooths.length,
        unsatisfiedCategoryCount: 0,
        overflowCount,
        removedOverlapCount: 0,
      }
    }
    const { newBooths, unsatisfiedCategoryCount } = placeBoothsAtSlots(
      perimeterSlots,
      {
        ...placementCtx,
        allowPerimeterEdgeFlush: true,
        perimeterOrientFrame,
      }
    )
    const { merged, unmovedCount, removedCount } = retainUnplacedVendorBooths(
      sourceBooths,
      newBooths,
      cw,
      cl,
      obstacles,
      wallInsetFt,
      doc
    )
    return {
      newVendorBooths: merged,
      vendorDroppedCount: unmovedCount,
      unsatisfiedCategoryCount,
      overflowCount,
      removedOverlapCount: removedCount,
    }
  }

  const layoutMode = autoArrangeModeToMarketLayout(mode)
  const deterministic = generateDeterministicMarketLayout({
    marketWidthFt: cw,
    marketHeightFt: cl,
    tableWidthFt: boothW,
    tableHeightFt: boothH,
    tableCount: sourceBooths.length,
    tableIds: sourceBooths.map((b) => b.id),
    layoutMode,
    aisleWidthFt,
    tableEdgeGapFt: BOOTH_PLACEMENT_GAP_FT,
    wallInsetFt,
    snapFt,
    entrance,
    restrictedZones: restrictedZonesFromObstacles(obstacles),
  })

  if (!deterministic.ok) {
    return {
      newVendorBooths: sourceBooths,
      vendorDroppedCount: sourceBooths.length,
      unsatisfiedCategoryCount: 0,
      overflowCount,
      removedOverlapCount: 0,
      perimeterCapacityError: deterministic.error,
    }
  }

  const perimeterOrientFrame: RoomFrame = {
    id: '__auto_arrange_canvas__',
    name: 'Canvas',
    originX: 0,
    originY: 0,
    widthFt: cw,
    lengthFt: cl,
  }

  const slotCandidates =
    deterministic.layoutSlotCandidates ??
    deterministic.placements.map((place) => ({
      x: place.x,
      y: place.y,
      row: place.row - 1,
      column: place.column - 1,
      rotation: place.rotation,
    }))
  const slots: Slot[] = slotCandidates.map((place) => {
    if (layoutMode === 'perimeter') {
      const edge = PERIMETER_ROW_TO_EDGE[place.row]
      return {
        x: place.x,
        y: place.y,
        perimeter: edge
          ? { x: place.x, y: place.y, edge }
          : undefined,
      }
    }
    return { x: place.x, y: place.y }
  })

  const { newBooths, unsatisfiedCategoryCount } = placeBoothsAtSlots(slots, {
    ...placementCtx,
    allowPerimeterEdgeFlush: layoutMode === 'perimeter',
    perimeterOrientFrame:
      layoutMode === 'perimeter' ? perimeterOrientFrame : undefined,
  })

  const { merged, unmovedCount, removedCount } = retainUnplacedVendorBooths(
    sourceBooths,
    newBooths,
    cw,
    cl,
    obstacles,
    wallInsetFt,
    doc
  )
  return {
    newVendorBooths: merged,
    vendorDroppedCount: unmovedCount,
    unsatisfiedCategoryCount,
    overflowCount,
    removedOverlapCount: removedCount,
    layoutExplanation: deterministic.explanation,
  }
}

function mergeAutoArrangeResult(
  doc: FloorPlanDoc,
  otherObjects: PlacedObject[],
  vendorPass: VendorAutoArrangePassResult,
  guestPass: GuestAutoArrangePassResult,
  scope: AutoArrangeScope,
  vendorSourceCount: number
): AutoArrangeResult {
  const allBooths = [...vendorPass.newVendorBooths, ...guestPass.placed]
  const vendorRepositioned = Math.max(0, vendorSourceCount - vendorPass.vendorDroppedCount)
  const patronRepositioned =
    guestPass.aborted ? 0 : guestPass.placed.length
  const placedCount =
    scope === 'vendor'
      ? vendorRepositioned
      : scope === 'patron'
        ? patronRepositioned
        : vendorRepositioned + patronRepositioned
  return {
    doc: { ...doc, objects: [...otherObjects, ...allBooths] },
    placedCount,
    droppedCount: guestPass.aborted
      ? 0
      : vendorPass.vendorDroppedCount + guestPass.dropped.length,
    unsatisfiedCategoryCount: vendorPass.unsatisfiedCategoryCount,
    overflowCount: vendorPass.overflowCount,
    removedOverlapCount: vendorPass.removedOverlapCount,
    perimeterCapacityError: vendorPass.perimeterCapacityError,
    layoutExplanation: vendorPass.layoutExplanation,
    patronArrangeAborted: guestPass.aborted
      ? PATRON_ARRANGE_DENSITY_ERROR
      : undefined,
  }
}

export function autoArrange(
  doc: FloorPlanDoc,
  options: AutoArrangeOptions = {}
): AutoArrangeResult {
  const scope = options.scope ?? 'all'
  const mode = normalizeAutoArrangeMode(options.mode)
  const {
    eventCategoryNames,
    maxBooths,
    baselineTableLengthFt,
    vendorTableMetaByKey,
    aisleWidthFt = DEFAULT_AISLE_WIDTH_FT,
  } = options

  const rawBooths = doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const guestBooths = rawBooths.filter((b) => isGuestTableBooth(b))
  const vendorRawBooths = rawBooths.filter((b) => !isGuestTableBooth(b))

  const baselineFt =
    baselineTableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  const allVendorBooths = consolidateBoothsForAutoArrange(
    vendorRawBooths,
    baselineFt,
    vendorTableMetaByKey
  )

  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const otherObjects = doc.objects.filter((o) => o.kind !== 'booth')
  const structuralObstacles = obstacleRectsFor({ ...doc, objects: otherObjects })
  const patronFixedObstacles =
    scope === 'patron' ? [] : boothFootprintObstacleRects(guestBooths, doc)
  const vendorObstacles = [...structuralObstacles, ...patronFixedObstacles]

  const hasVendor = allVendorBooths.length > 0
  const hasGuest = guestBooths.length > 0
  if (
    (scope === 'vendor' && !hasVendor) ||
    (scope === 'patron' && !hasGuest) ||
    (scope === 'all' && !hasVendor && !hasGuest)
  ) {
    return {
      doc,
      placedCount: 0,
      droppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount: 0,
      removedOverlapCount: 0,
    }
  }

  const sourceBooths =
    typeof maxBooths === 'number' && maxBooths >= 0
      ? allVendorBooths.slice(0, Math.floor(maxBooths))
      : allVendorBooths
  const overflowCount = allVendorBooths.length - sourceBooths.length

  const placementOrigin = options.placementOrigin ?? { x: 0, y: 0 }
  const localRing = options.placementOuterRing
    ? options.placementOuterRing.map(
        ([x, y]) =>
          [x - placementOrigin.x, y - placementOrigin.y] as [number, number]
      )
    : null

  const vendorPass =
    scope === 'patron'
      ? {
          newVendorBooths: vendorRawBooths,
          vendorDroppedCount: 0,
          unsatisfiedCategoryCount: 0,
          overflowCount: 0,
          removedOverlapCount: 0,
        }
      : autoArrangeVendorBooths(doc, sourceBooths, {
          mode,
          eventCategoryNames,
          aisleWidthFt,
          overflowCount,
          placementOrigin,
          localRing,
          otherObjects,
          obstacles: vendorObstacles,
        })

  const vendorRects =
    scope === 'patron'
      ? vendorRawBooths.map((b) => objectFootprintAabb(b))
      : vendorPass.newVendorBooths.map((b) => objectFootprintAabb(b))

  const guestPass =
    scope === 'vendor'
      ? { placed: guestBooths, dropped: [] as BoothObject[] }
      : arrangeGuestTables(guestBooths, {
          cw,
          cl,
          obstacles: structuralObstacles,
          vendorRects,
          mode,
          aisleWidthFt,
          snapFt: doc.snapFt > 0 ? doc.snapFt : 0.5,
          localRing,
          activeBoundingBox:
            scope === 'patron' ? guestActiveBoundingBox(guestBooths) : null,
        })

  const merged = mergeAutoArrangeResult(
    doc,
    otherObjects,
    vendorPass,
    guestPass,
    scope,
    sourceBooths.length
  )
  if (vendorPass.perimeterCapacityError && merged.placedCount === 0) {
    merged.perimeterCapacityError = vendorPass.perimeterCapacityError
  }
  return merged
}

/**
 * Returns true when a booth's AABB sits entirely inside a room frame
 * on the unified canvas (global coordinates).
 */
export function boothWithinRoomFrame(
  booth: BoothObject,
  frame: RoomFrame,
  doc?: FloorPlanDoc
): boolean {
  if (doc && frame.mergedIntoObjectId) {
    const surface = resolveRoomPlacementSurface(doc, frame.id)
    if (surface) {
      const cx = booth.x + booth.width / 2
      const cy = booth.y + booth.height / 2
      return pointInsidePlacementSurface({ x: cx, y: cy }, surface)
    }
  }
  return (
    booth.x >= frame.originX - 1e-6 &&
    booth.y >= frame.originY - 1e-6 &&
    booth.x + booth.width <= frame.originX + frame.widthFt + 1e-6 &&
    booth.y + booth.height <= frame.originY + frame.lengthFt + 1e-6
  )
}

/**
 * Run auto-arrange for a single room on a unified multi-room doc.
 *
 * Only objects tagged via `doc.objectRoom[id] === roomId` participate
 * in the pass; every other object is left untouched at its global
 * position. Booths are laid out in room-local coordinates bounded by
 * `[0, frame.widthFt] × [0, frame.lengthFt]`, then translated back
 * to global canvas space.
 */
export function autoArrangeInRoom(
  doc: FloorPlanDoc,
  roomId: string,
  options: AutoArrangeOptions = {}
): AutoArrangeInRoomResult | null {
  const frame = (doc.rooms ?? []).find((f) => f.id === roomId)
  if (!frame) return null

  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)
  const others = doc.objects.filter((o) => objectRoom[o.id] !== roomId)

  const scope = options.scope ?? 'all'
  const vendorBoothCount = inRoom.filter(
    (o) => o.kind === 'booth' && !isGuestTableBooth(o)
  ).length
  const patronTableCount = inRoom.filter(
    (o) => o.kind === 'booth' && isGuestTableBooth(o)
  ).length
  const boothCount = vendorBoothCount + patronTableCount
  const scopeEmpty =
    (scope === 'vendor' && vendorBoothCount === 0) ||
    (scope === 'patron' && patronTableCount === 0) ||
    (scope === 'all' && boothCount === 0)
  if (scopeEmpty) {
    return {
      doc,
      placedCount: 0,
      droppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount: 0,
      removedOverlapCount: 0,
      roomId,
    }
  }

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const localW = surface
    ? Math.max(1, surface.maxX - surface.minX)
    : frame.widthFt
  const localL = surface
    ? Math.max(1, surface.maxY - surface.minY)
    : frame.lengthFt

  const localObjects = inRoom
    .filter((o) => o.kind !== 'merged_zone')
    .map(
      (o) =>
        ({
          ...o,
          x: o.x - originX,
          y: o.y - originY,
        }) as PlacedObject
    )
  const localDoc: FloorPlanDoc = {
    canvasWidthFt: localW,
    canvasLengthFt: localL,
    gridSpacingFt: doc.gridSpacingFt,
    snapFt: doc.snapFt,
    objects: localObjects,
  }

  const arrangeOptions: AutoArrangeOptions = {
    ...options,
    placementOrigin: { x: originX, y: originY },
    placementOuterRing: surface?.outerRings[0],
  }

  const result = autoArrange(localDoc, arrangeOptions)
  const clippedObjects = result.doc.objects.map((o) => {
    if (o.kind !== 'booth') return o
    return clipBoothToLocalRoom(o as BoothObject, localW, localL, WALL_BUFFER_FT)
  })
  const reglobal = clippedObjects.map(
    (o) =>
      ({
        ...o,
        x: o.x + originX,
        y: o.y + originY,
      }) as PlacedObject
  )

  for (const obj of reglobal) {
    if (obj.kind !== 'booth') continue
    if (!boothWithinRoomFrame(obj, frame, doc)) {
      const clipped = clipBoothToLocalRoom(
        { ...(obj as BoothObject), x: obj.x - originX, y: obj.y - originY },
        localW,
        localL,
        WALL_BUFFER_FT
      )
      obj.x = clipped.x + originX
      obj.y = clipped.y + originY
    }
  }

  return {
    ...result,
    doc: {
      ...doc,
      objects: [...others, ...reglobal],
    },
    roomId,
  }
}

/**
 * Run auto-arrange independently inside every room frame. Each pass
 * only repositions booths owned by that room; proximity checks never
 * compare against booths in sibling rooms.
 */
export function autoArrangeAllRooms(
  doc: FloorPlanDoc,
  options: AutoArrangeOptions = {}
): AutoArrangeInRoomResult[] {
  const results: AutoArrangeInRoomResult[] = []
  let currentDoc = doc
  for (const frame of doc.rooms ?? []) {
    const result = autoArrangeInRoom(currentDoc, frame.id, options)
    if (!result) continue
    currentDoc = result.doc
    results.push(result)
  }
  return results
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function expandRectForClearance(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

/** Minimum edge-to-edge gap between two booth footprints (ft). */
function minBoothEdgeGapFt(a: BoothObject, b: BoothObject): number {
  const aGuest = isGuestTableBooth(a)
  const bGuest = isGuestTableBooth(b)
  if (aGuest && bGuest) return PATRON_TABLE_GAP_FT
  if (aGuest || bGuest) {
    return BOOTH_OBSTACLE_CLEARANCE_FT * 2
  }
  return BOOTH_PLACEMENT_GAP_FT
}

/**
 * Validate that an arranged doc obeys the v1 spec — used by tests.
 * Returns an array of human-readable violation strings; empty array
 * means the layout passes every rule.
 */
export function validateClearances(
  doc: FloorPlanDoc,
  options: { wallBufferFt?: number } = {}
): string[] {
  const errors: string[] = []
  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const wallBuffer = options.wallBufferFt ?? WALL_BUFFER_FT
  const booths = doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const overlapCtx = {
    canvasWidthFt: doc.canvasWidthFt,
    canvasLengthFt: doc.canvasLengthFt,
    gridSpacingFt: doc.gridSpacingFt,
    snapFt: doc.snapFt,
    objects: doc.objects,
    rooms: doc.rooms ?? [],
    objectRoom: doc.objectRoom,
  }

  for (const booth of booths) {
    const aabb = objectFootprintAabb(booth)
    if (aabb.x < wallBuffer - 1e-6) {
      errors.push(
        `booth ${booth.id} too close to left wall (x=${aabb.x}, need ≥${wallBuffer})`
      )
    }
    if (aabb.x + aabb.width > cw - wallBuffer + 1e-6) {
      errors.push(
        `booth ${booth.id} too close to right wall (right=${aabb.x + aabb.width}, max=${cw - wallBuffer})`
      )
    }
    if (aabb.y < wallBuffer - 1e-6) {
      errors.push(
        `booth ${booth.id} too close to top wall (y=${aabb.y}, need ≥${wallBuffer})`
      )
    }
    if (aabb.y + aabb.height > cl - wallBuffer + 1e-6) {
      errors.push(
        `booth ${booth.id} too close to bottom wall (bottom=${aabb.y + aabb.height}, max=${cl - wallBuffer})`
      )
    }
  }

  for (let i = 0; i < booths.length; i++) {
    for (let j = i + 1; j < booths.length; j++) {
      const a = booths[i]!
      const b = booths[j]!
      if (placedObjectsOverlap(a, b, overlapCtx)) {
        errors.push(`booths ${a.id} and ${b.id} overlap`)
      } else if (!isGuestTableBooth(a) && !isGuestTableBooth(b)) {
        // Vendor 360° probes are authoritative — skip redundant gap check.
      } else {
        const minGap = minBoothEdgeGapFt(a, b)
        if (
          boothsCloserThan(
            objectFootprintAabb(a),
            objectFootprintAabb(b),
            minGap
          )
        ) {
          errors.push(
            `booths ${a.id} and ${b.id} closer than ${minGap}ft edge clearance`
          )
        }
      }
    }
  }

  return errors
}
