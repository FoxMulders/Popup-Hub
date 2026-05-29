/**
 * Auto-Arrange engine — patron-centric winding aisles and perimeter mode.
 *
 * Modes:
 *   - `center-out` (default) — `calculatePatronCentricLayout`: serpentine
 *     patron corridor, chevron/herringbone angles, 60° sightline equity,
 *     rotated AABB collision (replaces rigid parallel rows).
 *   - `perimeter-only` — trace exterior walls, snap booths flush to
 *     interior faces with 2′ edge clearance between booths.
 *
 * Both modes honor structural obstacles, multi-table consolidation,
 * and same-category proximity rules.
 *
 * The function is pure: it returns a fresh `FloorPlanDoc` and does
 * not mutate the input. Boundaries are enforced — no booth ever sits
 * outside `[0, canvasWidthFt] × [0, canvasLengthFt]`.
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
import { calculatePatronCentricLayout } from './patron-centric-layout'

export {
  calculatePatronCentricLayout,
  type PatronCentricLayoutResult,
  type PatronLayoutObjectInput,
  type PatronCentricLayoutOptions,
  PATRON_CORRIDOR_WIDTH_FT,
  PATRON_VISION_CONE_DEG,
} from './patron-centric-layout'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'

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

export type AutoArrangeMode = 'center-out' | 'perimeter-only'

export interface AutoArrangeOptions {
  /** Placement strategy — defaults to center-out spiral. */
  mode?: AutoArrangeMode
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
    if (obj.kind === 'booth') continue // booths are the *input* count
    out.push(rotatedAabb(obj))
  }
  return out
}

interface Slot {
  x: number
  y: number
}

/** Center-out: grid slots sorted by distance from room centroid. */
function centerOutSlots(
  cw: number,
  cl: number,
  boothW: number,
  boothH: number
): Slot[] {
  const cx = cw / 2
  const cy = cl / 2
  const stepX = boothW + BOOTH_EDGE_CLEARANCE_FT
  const stepY = boothH + FRONT_CLEARANCE_FT
  const slots: Array<Slot & { dist: number }> = []
  for (let y = WALL_BUFFER_FT; y + boothH <= cl - WALL_BUFFER_FT; y += stepY) {
    for (let x = WALL_BUFFER_FT; x + boothW <= cw - WALL_BUFFER_FT; x += stepX) {
      const dist = Math.hypot(x + boothW / 2 - cx, y + boothH / 2 - cy)
      slots.push({ x, y, dist })
    }
  }
  slots.sort((a, b) => a.dist - b.dist)
  return slots
}

/** Perimeter-only: booths flush to interior wall faces, clockwise. */
function perimeterSlots(
  cw: number,
  cl: number,
  boothW: number,
  boothH: number
): Slot[] {
  const inset = PERIMETER_WALL_THICKNESS_FT + 0.5
  const step = boothW + BOOTH_EDGE_CLEARANCE_FT
  const stepY = boothH + BOOTH_EDGE_CLEARANCE_FT
  const slots: Slot[] = []

  for (let x = inset; x + boothW <= cw - inset; x += step) {
    slots.push({ x, y: inset })
  }
  for (let y = inset + boothH + BOOTH_EDGE_CLEARANCE_FT; y + boothH <= cl - inset; y += stepY) {
    slots.push({ x: cw - inset - boothW, y })
  }
  for (let x = cw - inset - boothW - step; x >= inset; x -= step) {
    slots.push({ x, y: cl - inset - boothH })
  }
  for (let y = cl - inset - boothH - stepY; y >= inset + boothH + BOOTH_EDGE_CLEARANCE_FT; y -= stepY) {
    slots.push({ x: inset, y })
  }

  return slots
}

interface PlacementContext {
  cw: number
  cl: number
  boothW: number
  boothH: number
  obstacles: Rect[]
  sourceBooths: BoothObject[]
  eventCategoryNames?: ReadonlyArray<string>
  gridSpacingFt: number
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
    const placed: BoothObject = {
      ...src,
      x: candidate.x,
      y: candidate.y,
      width: boothW,
      height: boothH,
      rotation: 0,
      categoryName: finalCategory,
    }
    newBooths.push(placed)
    placedRects.push(candidate)
  }

  return { newBooths, placedRects, unsatisfiedCategoryCount }
}

/**
 * Run auto-arrange in the selected mode (center-out or perimeter-only).
 */
export function autoArrange(
  doc: FloorPlanDoc,
  options: AutoArrangeOptions = {}
): AutoArrangeResult {
  const {
    mode = 'center-out',
    eventCategoryNames,
    maxBooths,
    baselineTableLengthFt,
    vendorTableMetaByKey,
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

  if (mode === 'perimeter-only') {
    const slots = perimeterSlots(cw, cl, boothW, boothH)
    if (slots.length === 0) {
      return {
        doc: { ...doc, objects: otherObjects },
        placedCount: 0,
        droppedCount: sourceBooths.length,
        unsatisfiedCategoryCount: 0,
        overflowCount,
      }
    }
    const { newBooths, unsatisfiedCategoryCount } = placeBoothsAtSlots(slots, {
      cw,
      cl,
      boothW,
      boothH,
      obstacles,
      sourceBooths,
      eventCategoryNames,
      gridSpacingFt,
    })
    const placedCount = newBooths.length
    return {
      doc: { ...doc, objects: [...otherObjects, ...newBooths] },
      placedCount,
      droppedCount: sourceBooths.length - placedCount,
      unsatisfiedCategoryCount,
      overflowCount,
    }
  }

  const doors = otherObjects.filter((o) => o.kind === 'door')
  const entranceDoor =
    doors.find((d) => d.kind === 'door' && d.doorType === 'entrance') ??
    doors[0]
  const exitObj =
    otherObjects.find((o) => o.kind === 'emergency_exit') ??
    doors.find((d) => d.kind === 'door' && d.doorType === 'exit')

  const entrance = entranceDoor
    ? {
        x: entranceDoor.x + entranceDoor.width / 2,
        y: entranceDoor.y + entranceDoor.height / 2,
      }
    : undefined
  const exit = exitObj
    ? {
        x: exitObj.x + exitObj.width / 2,
        y: exitObj.y + exitObj.height / 2,
      }
    : undefined

  const patronLayout = calculatePatronCentricLayout(cw, cl, sourceBooths, {
    obstacles,
    entrance,
    exit,
    gridSpacingFt,
    eventCategoryNames,
    layoutStyle: 'chevron-45',
  })

  let newBooths: BoothObject[] = patronLayout.placed.map((p) => ({
    ...p,
    kind: 'booth' as const,
    accentColor: p.accentColor ?? null,
  }))

  const placedIds = new Set(newBooths.map((b) => b.id))
  const remaining = sourceBooths.filter((s) => !placedIds.has(s.id))

  if (remaining.length > 0) {
    const fillSlots = centerOutSlots(cw, cl, boothW, boothH)
    const { newBooths: filled, unsatisfiedCategoryCount: fillUnsat } =
      placeBoothsAtSlots(fillSlots, {
        cw,
        cl,
        boothW,
        boothH,
        obstacles: [
          ...obstacles,
          ...newBooths.map((b) =>
            expandRectForClearance(rotatedAabb(b), BOOTH_EDGE_CLEARANCE_FT)
          ),
        ],
        sourceBooths: remaining,
        eventCategoryNames,
        gridSpacingFt,
      })
    newBooths = [...newBooths, ...filled]
    patronLayout.unsatisfiedCategoryCount += fillUnsat
  }

  const placedCount = newBooths.length
  const droppedCount = sourceBooths.length - placedCount

  return {
    doc: {
      ...doc,
      objects: [...otherObjects, ...newBooths],
    },
    placedCount,
    droppedCount,
    unsatisfiedCategoryCount: patronLayout.unsatisfiedCategoryCount,
    overflowCount,
  }
}

/**
 * Returns true when a booth's AABB sits entirely inside a room frame
 * on the unified canvas (global coordinates).
 */
export function boothWithinRoomFrame(
  booth: BoothObject,
  frame: RoomFrame
): boolean {
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

  const localObjects = inRoom.map(
    (o) =>
      ({
        ...o,
        x: o.x - frame.originX,
        y: o.y - frame.originY,
      }) as PlacedObject
  )
  const localDoc: FloorPlanDoc = {
    canvasWidthFt: frame.widthFt,
    canvasLengthFt: frame.lengthFt,
    gridSpacingFt: doc.gridSpacingFt,
    snapFt: doc.snapFt,
    objects: localObjects,
  }

  const result = autoArrange(localDoc, options)
  const reglobal = result.doc.objects.map(
    (o) =>
      ({
        ...o,
        x: o.x + frame.originX,
        y: o.y + frame.originY,
      }) as PlacedObject
  )

  for (const obj of reglobal) {
    if (obj.kind !== 'booth') continue
    if (!boothWithinRoomFrame(obj, frame)) {
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
