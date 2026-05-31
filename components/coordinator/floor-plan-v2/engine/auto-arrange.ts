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
 * and same-category proximity when slots remain after deterministic placement.
 */

import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '../state/types'
import {
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
import {
  consolidateBoothsForAutoArrange,
  type VendorTableMeta,
} from '@/lib/booth-planner/table-booth-consolidation'
import {
  autoArrangeModeToMarketLayout,
  DEFAULT_AISLE_WIDTH_FT,
  generateDeterministicMarketLayout,
} from '@/lib/floor-plan/deterministic-market-layout'

export {
  calculatePatronCentricLayout,
  type PatronCentricLayoutResult,
  type PatronLayoutObjectInput,
  type PatronCentricLayoutOptions,
  PATRON_CORRIDOR_WIDTH_FT,
  PATRON_VISION_CONE_DEG,
} from './patron-centric-layout'

export {
  generateDeterministicMarketLayout,
  maxPerimeterTableCapacity,
  type DeterministicMarketLayoutInput,
  type DeterministicMarketLayoutResult,
  type MarketLayoutMode,
  type MarketLayoutTablePlacement,
  DEFAULT_AISLE_WIDTH_FT,
} from '@/lib/floor-plan/deterministic-market-layout'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import {
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
/** Wall to back of vendor booth (2 chairs). */
export const WALL_BUFFER_FT = CHAIR_LENGTH_FT * 2
/** Back-to-back island gap (2 chairs back-to-back + 1 walking buffer). */
export const BACK_TO_BACK_GAP_FT = CHAIR_LENGTH_FT * 3
/** Front-of-booth clearance — uses the patron-pair width. */
export const FRONT_CLEARANCE_FT = PATRON_PAIR_WIDTH_FT
/**
 * Mandatory edge-to-edge gap between booth footprints (side and back).
 * Row pack advances X by `boothW + BOOTH_EDGE_CLEARANCE_FT` so slots
 * never sit flush.
 */
export const BOOTH_EDGE_CLEARANCE_FT = 2

export type AutoArrangeMode = 'grid' | 'staggered' | 'perimeter-only'

/** @deprecated Use `grid` — kept for persisted UI / old URLs. */
export type AutoArrangeModeLegacy = AutoArrangeMode | 'center-out'

function normalizeAutoArrangeMode(
  mode: AutoArrangeModeLegacy | undefined
): AutoArrangeMode {
  if (mode === 'center-out' || mode == null) return 'grid'
  return mode
}

export interface AutoArrangeOptions {
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
   * (`< 5 columns AND < 2 rows`) against an already-placed booth.
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
  /** Set when perimeter-only mode cannot fit all booths on the boundary. */
  perimeterCapacityError?: string
  /** Human-readable summary of the deterministic layout pass. */
  layoutExplanation?: string
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
  /** When set, perimeter slots orient booths against this frame. */
  perimeterOrientFrame?: RoomFrame
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
    perimeterOrientFrame,
  } = ctx
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

  for (const slot of slots) {
    if (nextSourceIdx >= sourceBooths.length) break
    const candidate: Rect = {
      x: slot.x,
      y: slot.y,
      width: boothW,
      height: boothH,
    }
    if (candidate.x + boothW > cw || candidate.y + boothH > cl) continue
    const hitsObstacle = obstacles.some((r) => aabbOverlap(candidate, r))
    const hitsBooth = placedRects.some((r) =>
      boothsCloserThan(candidate, r, BOOTH_EDGE_CLEARANCE_FT)
    )
    if (hitsObstacle || hitsBooth) continue

    const src = sourceBooths[nextSourceIdx++]!
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
    let placed: BoothObject = {
      ...src,
      x: candidate.x,
      y: candidate.y,
      width: boothW,
      height: boothH,
      rotation: 0,
      categoryName: finalCategory,
    }
    if (slot.perimeter?.direct) {
      placed = {
        ...placed,
        x: slot.perimeter.x,
        y: slot.perimeter.y,
        width: boothW,
        height: boothH,
        rotation: rotationForPerimeterEdge(slot.perimeter.edge),
      }
    } else if (slot.perimeter && perimeterOrientFrame) {
      placed = orientBoothForPerimeterSlot(
        placed,
        slot.perimeter,
        boothW,
        boothH,
        perimeterOrientFrame
      )
    }
    const placedRect = rotatedAabb(placed)
    newBooths.push(placed)
    placedRects.push(placedRect)
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

const PERIMETER_ROW_TO_EDGE: Record<
  number,
  import('../interactions/perimeter-booth-orientation').RoomEdgeSide
> = {
  0: 'top',
  1: 'right',
  2: 'bottom',
  3: 'left',
}

export function autoArrange(
  doc: FloorPlanDoc,
  options: AutoArrangeOptions = {}
): AutoArrangeResult {
  const mode = normalizeAutoArrangeMode(options.mode)
  const {
    eventCategoryNames,
    maxBooths,
    baselineTableLengthFt,
    vendorTableMetaByKey,
    aisleWidthFt = DEFAULT_AISLE_WIDTH_FT,
  } = options

  const rawSourceBooths = doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const baselineFt =
    baselineTableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  const allSourceBooths = consolidateBoothsForAutoArrange(
    rawSourceBooths,
    baselineFt,
    vendorTableMetaByKey
  )
  if (allSourceBooths.length === 0) {
    return {
      doc,
      placedCount: 0,
      droppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount: 0,
    }
  }

  /*
   * Apply the structural booth ceiling from Step 2 (which already
   * subtracts walking aisles and fire paths). Booths past the cap
   * are dropped before any physical placement attempt — they don't
   * deserve a slot because the venue can't safely host them.
   */
  const sourceBooths =
    typeof maxBooths === 'number' && maxBooths >= 0
      ? allSourceBooths.slice(0, Math.floor(maxBooths))
      : allSourceBooths
  const overflowCount = allSourceBooths.length - sourceBooths.length
  if (sourceBooths.length === 0) {
    return {
      doc: {
        ...doc,
        objects: doc.objects.filter((o) => o.kind !== 'booth'),
      },
      placedCount: 0,
      droppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount,
    }
  }

  // Use the median footprint so a single oversized outlier booth
  // doesn't blow up every row's spacing. Snap to 0.5ft for tidy grid
  // alignment.
  const widths = [...sourceBooths.map((b) => b.width)].sort((a, b) => a - b)
  const heights = [...sourceBooths.map((b) => b.height)].sort((a, b) => a - b)
  const boothW = roundHalf(widths[Math.floor(widths.length / 2)] ?? 6)
  const boothH = roundHalf(heights[Math.floor(heights.length / 2)] ?? 5)

  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt

  const otherObjects = doc.objects.filter((o) => o.kind !== 'booth')
  const obstacles = obstacleRectsFor({ ...doc, objects: otherObjects })

  const gridSpacingFt = doc.gridSpacingFt > 0 ? doc.gridSpacingFt : 1
  const snapFt = doc.snapFt > 0 ? doc.snapFt : 0.5

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

  const placementOrigin = options.placementOrigin ?? { x: 0, y: 0 }
  const localRing = options.placementOuterRing
    ? options.placementOuterRing.map(
        ([x, y]) =>
          [x - placementOrigin.x, y - placementOrigin.y] as [number, number]
      )
    : null

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
        doc: { ...doc, objects: otherObjects },
        placedCount: 0,
        droppedCount: sourceBooths.length,
        unsatisfiedCategoryCount: 0,
        overflowCount,
      }
    }
    const { newBooths, unsatisfiedCategoryCount } = placeBoothsAtSlots(
      perimeterSlots,
      {
        cw,
        cl,
        boothW,
        boothH,
        obstacles,
        sourceBooths,
        eventCategoryNames,
        gridSpacingFt,
        perimeterOrientFrame,
      }
    )
    const placedCount = newBooths.length
    return {
      doc: { ...doc, objects: [...otherObjects, ...newBooths] },
      placedCount,
      droppedCount: sourceBooths.length - placedCount,
      unsatisfiedCategoryCount,
      overflowCount,
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
    wallInsetFt: WALL_BUFFER_FT,
    snapFt,
    entrance,
    restrictedZones: restrictedZonesFromObstacles(obstacles),
  })

  if (!deterministic.ok) {
    return {
      doc: { ...doc, objects: otherObjects },
      placedCount: 0,
      droppedCount: sourceBooths.length,
      unsatisfiedCategoryCount: 0,
      overflowCount,
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

  const slots: Slot[] = deterministic.placements.map((place) => {
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
    cw,
    cl,
    boothW,
    boothH,
    obstacles,
    sourceBooths,
    eventCategoryNames,
    gridSpacingFt,
    perimeterOrientFrame:
      layoutMode === 'perimeter' ? perimeterOrientFrame : undefined,
  })

  const placedCount = newBooths.length
  const droppedCount = sourceBooths.length - placedCount

  return {
    doc: {
      ...doc,
      objects: [...otherObjects, ...newBooths],
    },
    placedCount,
    droppedCount,
    unsatisfiedCategoryCount,
    overflowCount,
    layoutExplanation: deterministic.explanation,
  }
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

  const boothCount = inRoom.filter((o) => o.kind === 'booth').length
  if (boothCount === 0) {
    return {
      doc,
      placedCount: 0,
      droppedCount: 0,
      unsatisfiedCategoryCount: 0,
      overflowCount: 0,
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
  const reglobal = result.doc.objects.map(
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
      throw new Error(
        `auto-arrange placed booth ${obj.id} outside room ${roomId} bounds`
      )
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
      if (placedObjectsOverlap(a, b)) {
        errors.push(`booths ${a.id} and ${b.id} overlap`)
      } else if (
        boothsCloserThan(
          objectFootprintAabb(a),
          objectFootprintAabb(b),
          BOOTH_EDGE_CLEARANCE_FT
        )
      ) {
        errors.push(
          `booths ${a.id} and ${b.id} closer than ${BOOTH_EDGE_CLEARANCE_FT}ft edge clearance`
        )
      }
    }
  }

  return errors
}
