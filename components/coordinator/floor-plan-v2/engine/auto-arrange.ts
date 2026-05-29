/**
 * Auto-Arrange engine — v1 (clearance-aware row pack).
 *
 * What this does:
 * - Treats every existing booth in the doc as the *count* of booths the
 *   coordinator wants placed (preserves dimensions of the largest one
 *   so visual footprint stays consistent).
 * - Lays the booths out in straight north-facing rows (front edge =
 *   bottom edge of the rect) with hard clearance rules from the spec:
 *     * Front-path clearance: 5 ft in front of every booth so two
 *       patrons can walk side-by-side (PATRON_PAIR_WIDTH_FT).
 *     * Wall buffer: 3.5 ft from any venue wall (= 2 chair lengths,
 *       so vendors can sit + access from behind).
 *     * Back-to-back gap: 5.25 ft between back-to-back rows
 *       (= 2 chairs + 1 walking buffer).
 *     * Booth edge buffer: 2 ft between every booth footprint
 *       (horizontal slot step and row spacing floors).
 * - Honors structural obstacles: walls, doors, and emergency_exit
 *   objects already placed in the doc are treated as immovable; the
 *   row pack routes around their AABBs.
 * - Diversifies categories with a strict same-category proximity
 *   guard: when the rotor would assign category X to a slot whose
 *   center sits within `< 5 columns AND < 2 rows` of any already-placed
 *   same-category booth, we skip past category X to the next category
 *   that satisfies the guard. This is the same threshold the canvas
 *   pointer hook uses on manual drags (`PROXIMITY_MIN_COLUMNS = 5`,
 *   `PROXIMITY_MIN_ROWS = 2`), so an arranged layout never produces a
 *   violation that a coordinator's mouse would have been blocked
 *   from creating.
 *
 * What this DOES NOT do (deferred to v2):
 * - Patron pathfinding simulation / 100% visibility scoring.
 * - Raised-stage-extension that reaches outside the canvas walls.
 * - Round/rectangle dining tables in central plazas.
 * - Anchor placement (food trucks at the rear of the venue).
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
import { rotatedAabb } from '../interactions/geometry'
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

export interface AutoArrangeOptions {
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
 * Aisles are NOT obstacles: they're meant to be traversable, and the
 * engine's row clearance already provides walking space.
 */
function obstacleRectsFor(doc: FloorPlanDoc): Rect[] {
  const out: Rect[] = []
  for (const obj of doc.objects) {
    if (obj.kind === 'aisle') continue
    if (obj.kind === 'booth') continue // booths are the *input* count
    out.push(rotatedAabb(obj))
  }
  return out
}

interface RowPlan {
  /** Row top-edge in ft (y of the booth back-edge). */
  rowTopY: number
  /** Booth height in ft (uniform per-row). */
  rowHeight: number
  /** y-cursor for the next row's top edge. */
  nextRowTopY: number
}

/**
 * Run the v1 auto-arrange pass.
 *
 * Algorithm in plain English:
 *   1. Snapshot the current booth list. We use it both as the source
 *      of "how many to place" and as the source of dimensions
 *      (the median width × height — uniform rows look intentional).
 *   2. Strip booths from the doc; keep walls/doors/exits/stages.
 *   3. Walk top-down in rows, each row = (booth height) +
 *      (front clearance). Wall buffer offsets the first row from
 *      the top edge.
 *   4. Inside each row, walk left-to-right placing booth-width
 *      slots separated by `BOOTH_EDGE_CLEARANCE_FT` (2′ side gap).
 *   5. Skip any slot whose AABB overlaps an obstacle.
 *   6. Assign categories round-robin from `eventCategoryNames` so
 *      no two adjacent slots share a category.
 *   7. Rinse repeat until we run out of vertical space or have
 *      placed every booth from the input.
 */
export function autoArrange(
  doc: FloorPlanDoc,
  options: AutoArrangeOptions = {}
): AutoArrangeResult {
  const { eventCategoryNames, maxBooths, baselineTableLengthFt, vendorTableMetaByKey } =
    options

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

  // Strip the existing booths but keep all other objects (walls/
  // doors/exits/stages/labels/aisles) so the engine can route the
  // pack around them.
  const otherObjects = doc.objects.filter((o) => o.kind !== 'booth')
  const obstacles = obstacleRectsFor({ ...doc, objects: otherObjects })

  // Plan the row schedule. Each row consists of:
  //   booth (boothH) + front clearance (FRONT_CLEARANCE_FT)
  // We pair rows back-to-back when possible to maximize density:
  // two rows of booths face away from each other, with the gap
  // between their backs being BACK_TO_BACK_GAP_FT.
  //
  // Row schedule (top to bottom):
  //   WALL_BUFFER_FT
  //   row A booth (boothH)
  //   FRONT_CLEARANCE_FT
  //   row A patron walk (free space; no rect)
  //   row B booth (boothH)  ← faces opposite direction (front-up)
  //   FRONT_CLEARANCE_FT (already counted as row A's walk)
  //   ... OR (no room for row B):
  //   row A booth (boothH)
  //   FRONT_CLEARANCE_FT
  //   row A walk (≥ PATRON_PAIR_WIDTH_FT)
  // For v1 we simplify: every row is "booth then forward clearance",
  // and we pair adjacent rows so two rows share a single back-to-back
  // gap. The first row sits WALL_BUFFER_FT from the top.
  const rows: RowPlan[] = []
  let cursorY = WALL_BUFFER_FT
  // Pairs of rows are separated by the back-to-back gap; the gap
  // between two pair-internal rows is FRONT_CLEARANCE_FT.
  let inPair = false
  while (cursorY + boothH + WALL_BUFFER_FT <= cl) {
    const rowTopY = cursorY
    rows.push({
      rowTopY,
      rowHeight: boothH,
      nextRowTopY: 0, // filled in below
    })
    cursorY = rowTopY + boothH
    if (inPair) {
      // Just placed the second row of a pair — next gap is
      // back-to-back, then the next pair starts.
      cursorY += BACK_TO_BACK_GAP_FT
      inPair = false
    } else {
      // Just placed the first row of a (possible) pair — next gap is
      // front clearance, then the second row of the pair starts.
      cursorY += FRONT_CLEARANCE_FT
      inPair = true
    }
  }
  // Trim a trailing odd row if there isn't enough room for the wall
  // buffer below it.
  while (
    rows.length > 0 &&
    rows[rows.length - 1]!.rowTopY + boothH + WALL_BUFFER_FT > cl
  ) {
    rows.pop()
  }
  if (rows.length === 0) {
    return {
      doc: { ...doc, objects: otherObjects },
      placedCount: 0,
      droppedCount: sourceBooths.length,
      unsatisfiedCategoryCount: 0,
      overflowCount,
    }
  }

  const placedRects: Rect[] = []
  const newBooths: BoothObject[] = []
  let nextSourceIdx = 0
  let categoryRotor = 0
  const categoryCount = eventCategoryNames?.length ?? 0
  /*
   * Per-category use count. The slot allocator prefers the
   * least-used category at each step (with the rotor as the tie
   * breaker), so a 50-booth row with 4 categories spreads as
   * 12-13-12-13 rather than dumping all of category[0] on the
   * left half before rotating.
   */
  const categoryUseCount = new Map<string, number>()
  if (eventCategoryNames) {
    for (const name of eventCategoryNames) categoryUseCount.set(name, 0)
  }
  let unsatisfiedCategoryCount = 0
  const gridSpacingFt = doc.gridSpacingFt > 0 ? doc.gridSpacingFt : 1

  /*
   * Returns true if a booth of `category` placed at `rect` would sit
   * within `< 5 columns AND < 2 rows` (center-to-center, in grid
   * spaces) of any already-placed booth that shares the same
   * category. Mirrors `findBoothProximityViolation` from
   * interactions/category-rules but works directly on the engine's
   * rect/category pair so we don't have to round-trip through the
   * BoothObject shape during the inner loop.
   */
  function violatesProximity(
    rect: Rect,
    category: string | null
  ): boolean {
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

  /*
   * Pick the best category for the candidate slot.
   *
   *   1. Build the rotor-ordered list (rotor, rotor+1, … wrap) so
   *      sequential slots still tend to alternate categories.
   *   2. Stable-sort that list by current use-count ascending — the
   *      least-used category wins ties so the layout balances over
   *      the full canvas.
   *   3. Walk the sorted list and pick the first category whose
   *      placement at `rect` does NOT violate the proximity rule.
   *   4. If every candidate violates, return `null`. The caller
   *      records the slot as "untagged" and increments the
   *      unsatisfied counter so the UI can warn the coordinator.
   *
   * Returns the chosen category name plus the number of categories
   * we walked past so the caller can advance the rotor accordingly
   * (skipping past blocked categories prevents the same blocked
   * pick from being tried again on the next slot).
   */
  function pickCategoryForSlot(rect: Rect): {
    category: string | null
    advanceBy: number
  } {
    if (categoryCount === 0) return { category: null, advanceBy: 0 }
    const candidates: Array<{ name: string; rotorIdx: number }> = []
    for (let i = 0; i < categoryCount; i++) {
      const idx = (categoryRotor + i) % categoryCount
      candidates.push({
        name: eventCategoryNames![idx]!,
        rotorIdx: i,
      })
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

  for (const row of rows) {
    if (nextSourceIdx >= sourceBooths.length) break
    let x = WALL_BUFFER_FT
    while (
      x + boothW + WALL_BUFFER_FT <= cw &&
      nextSourceIdx < sourceBooths.length
    ) {
      const candidate: Rect = {
        x,
        y: row.rowTopY,
        width: boothW,
        height: boothH,
      }

      // Check against fixed obstacles.
      const hitsObstacle = obstacles.some((r) => aabbOverlap(candidate, r))
      // Check against already-placed booths (mandatory 2ft edge gap).
      const hitsBooth = placedRects.some((r) =>
        boothsCloserThan(candidate, r, BOOTH_EDGE_CLEARANCE_FT)
      )

      if (!hitsObstacle && !hitsBooth) {
        const src = sourceBooths[nextSourceIdx++]!
        const { category, advanceBy } = pickCategoryForSlot(candidate)
        if (categoryCount > 0) {
          categoryRotor = (categoryRotor + advanceBy) % categoryCount
        }
        if (category) {
          categoryUseCount.set(
            category,
            (categoryUseCount.get(category) ?? 0) + 1
          )
        } else if (categoryCount > 0) {
          // Every category candidate was blocked by the proximity
          // rule. Drop the booth into the layout untagged so it still
          // satisfies the physical clearance pass, and surface the
          // overflow count so the coordinator can widen the room.
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
      x += boothW + BOOTH_EDGE_CLEARANCE_FT
    }
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
    unsatisfiedCategoryCount,
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

/**
 * Validate that an arranged doc obeys the v1 spec — used by tests.
 * Returns an array of human-readable violation strings; empty array
 * means the layout passes every rule.
 */
export function validateClearances(doc: FloorPlanDoc): string[] {
  const errors: string[] = []
  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const booths = doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )

  for (const booth of booths) {
    if (booth.x < WALL_BUFFER_FT - 1e-6) {
      errors.push(
        `booth ${booth.id} too close to left wall (x=${booth.x}, need ≥${WALL_BUFFER_FT})`
      )
    }
    if (booth.x + booth.width > cw - WALL_BUFFER_FT + 1e-6) {
      errors.push(
        `booth ${booth.id} too close to right wall (right=${booth.x + booth.width}, max=${cw - WALL_BUFFER_FT})`
      )
    }
    if (booth.y < WALL_BUFFER_FT - 1e-6) {
      errors.push(
        `booth ${booth.id} too close to top wall (y=${booth.y}, need ≥${WALL_BUFFER_FT})`
      )
    }
    if (booth.y + booth.height > cl - WALL_BUFFER_FT + 1e-6) {
      errors.push(
        `booth ${booth.id} too close to bottom wall (bottom=${booth.y + booth.height}, max=${cl - WALL_BUFFER_FT})`
      )
    }
  }

  for (let i = 0; i < booths.length; i++) {
    for (let j = i + 1; j < booths.length; j++) {
      const a = booths[i]!
      const b = booths[j]!
      const ra = { x: a.x, y: a.y, width: a.width, height: a.height }
      const rb = { x: b.x, y: b.y, width: b.width, height: b.height }
      if (aabbOverlap(ra, rb)) {
        errors.push(`booths ${a.id} and ${b.id} overlap`)
      } else if (boothsCloserThan(ra, rb, BOOTH_EDGE_CLEARANCE_FT)) {
        errors.push(
          `booths ${a.id} and ${b.id} closer than ${BOOTH_EDGE_CLEARANCE_FT}ft edge clearance`
        )
      }
    }
  }

  return errors
}
