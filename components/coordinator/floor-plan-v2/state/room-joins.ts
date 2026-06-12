/**
 * Room joins — dynamic polygon union and shared-wall dissolving.
 *
 * Background
 * ----------
 * Adjacent rooms whose edges happen to coincide already get their
 * shared wall suppressed by the rectilinear interval math in
 * `interactions/geometry.ts` (`computeRoomWallSegments`). That gives
 * coordinators a clean visual when they butt rooms up against each
 * other, but it stops short of the user-invokable "Join / Combine"
 * action requested in the goal:
 *
 *   1. detect when a room overlaps OR touches another (not just
 *      coincident-edge touching), and
 *   2. on demand, fuse the touching/overlapping rooms into a single
 *      logical zone whose outer perimeter is one continuous polygon
 *      and whose interior walls are dissolved entirely.
 *
 * For (1) and (2) we use `polygon-clipping` — a tiny, well-tested
 * Martinez-Rueda implementation that gives us boolean union /
 * intersection / difference on Polygon and MultiPolygon geometries.
 *
 * Coordinate system
 * -----------------
 * Everything in this module operates in canvas-global feet (the same
 * frame `RoomFrame.originX/originY` use). Polygons are emitted in the
 * `polygon-clipping` convention:
 *
 *   - A `Ring` is `[[x, y], [x, y], ...]` with the first and last
 *     point repeated (closed).
 *   - A `Polygon` is `[outerRing, hole1, hole2, ...]`.
 *   - A `MultiPolygon` is `Polygon[]`.
 *
 * The library expects rings to be wound CCW for outer rings and CW
 * for holes; emitting a CCW ring for our axis-aligned room rectangles
 * works out of the box because we trace `(x,y) → (x+w,y) → (x+w,y+l)
 * → (x,y+l) → (x,y)` which is CCW under our screen-space coordinate
 * system (y grows down) — *but* the library normalizes anyway, so we
 * don't depend on the winding order.
 */

// The package ships a TypeScript declaration that lists `union`,
// `intersection`, etc. as named exports, but the actual ESM bundle
// only emits a default export — Turbopack flags the named imports
// as missing exports. We sidestep that mismatch with a default
// import (typed locally) and pick the methods off the resulting
// object at runtime.
import type {
  MultiPolygon,
  Polygon,
  Ring,
} from 'polygon-clipping'

import polygonClippingDefault from 'polygon-clipping'

import {
  mergeAdjacentStructuresMany,
  pathsToClosedRings,
  structureFromRect,
  type ArchitecturalStructure,
  type WallSegment2,
} from '@/lib/floor-plan/merge-adjacent-structures'
import {
  guardedPolygonUnion,
  normalizePolygonForUnion,
} from '@/lib/floor-plan/polygon-clipping-union'
import {
  ensurePlacementOuterRings,
  interiorAnchorFromBounds,
} from '@/lib/floor-plan/placement-ring-orientation'
import { placedObjectFootprintRing } from '@/lib/floor-plan/shape-union'

import type {
  ObjectKind,
  PlacedObject,
  RoomFrame,
} from './types'
import {
  computeRoomWallSegments,
  pointDistanceToSegment,
  pointHitsFrameStroke,
} from '../interactions/geometry'

export {
  mergeAdjacentStructures,
  mergeAdjacentStructuresMany,
  structureFromRect,
  wallsFromRect,
  segmentsAreInternalBarrier,
  type ArchitecturalStructure,
  type MergeAdjacentStructuresResult,
  type NormalizedSeg,
  type Vec2,
  type WallSegment2,
} from '@/lib/floor-plan/merge-adjacent-structures'

// `Geom` is the polygon-clipping internal union type — re-derive it
// because the package only exports it privately.
type Geom = Polygon | MultiPolygon

// Re-shape the default export so callers get the named-method API
// even though the .d.ts disagrees with the ESM runtime shape.
type PolygonClipping = {
  union: (geom: Geom, ...geoms: Geom[]) => MultiPolygon
  intersection: (geom: Geom, ...geoms: Geom[]) => MultiPolygon
}
const polygonClipping = polygonClippingDefault as unknown as PolygonClipping

// Re-export for callers that don't want to import directly from the
// vendor package.
export type {
  MultiPolygon as RoomJoinMultiPolygon,
  Polygon as RoomJoinPolygon,
  Ring as RoomJoinRing,
}

/** Axis-aligned bounding box in canvas feet. */
export interface RoomJoinBbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** A user-defined room-fusion. Children of every member behave as a
 *  single zone for selection / boundary-check / save purposes. */
export interface JoinedZone {
  /** Stable id assigned the moment the group is created. */
  groupId: string
  /** Member room ids (in insertion order). */
  frameIds: string[]
  /** Member object ids (auxiliary `PlacedObject`s annexed into the
   *  zone, e.g. an outdoor stage that overlaps the perimeter). */
  objectIds: string[]
  /** Outer rings of the dissolved perimeter. */
  rings: Ring[]
  /** Outer wall segments after boolean union (no interior dividers). */
  perimeterWalls: WallSegment2[]
  /** Bounding box of the union polygon. */
  aabb: RoomJoinBbox
  /** Total floor-area of the dissolved zone, in square feet. */
  areaSqFt: number
}

/** ~5 canvas pixels at 12 px/ft — adjacent rooms need not be pixel-perfect. */
export const DEFAULT_TOUCH_EPSILON_FT = 5 / 12

// ---------------------------------------------------------------------------
// Asset-type gating
// ---------------------------------------------------------------------------
//
// Polygon joining is intentionally restricted: only auxiliary spaces and
// performance fixtures can extend the perimeter wall. Standard vendor
// booths, tables, aisles, doors, labels, and walls cannot trigger a
// join. This keeps the "Join" action semantically meaningful — it
// represents an architectural extension of the floor plan, not a
// general-purpose grouping operation.

/**
 * `PlacedObject` kinds that are eligible to extend the perimeter wall
 * via the Join action. A stage is the canonical case: an outdoor or
 * raised performance fixture that physically extends the room's
 * footprint.
 *
 * Booths, walls, aisles, labels, doors, exits, and open-walls are
 * *not* in this set — see the goal ("Explicitly disable or hide the
 * join feature for standard vendor booths, tables, or generic layout
 * assets").
 */
export const JOINABLE_OBJECT_KINDS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'stage',
])

/**
 * Returns true when `obj` is an architectural/performance fixture
 * eligible to extend the perimeter wall. Standard floor assets
 * (booths, tables, aisles) return false.
 */
export function isJoinableObject(obj: PlacedObject): boolean {
  return JOINABLE_OBJECT_KINDS.has(obj.kind)
}

/**
 * Auxiliary-room name pattern. Any `RoomFrame` whose name matches
 * this regex (case-insensitive) is treated as an auxiliary space —
 * the kind that *initiates* a Join action against the primary Main
 * Hall. The Main Hall itself can be a join *target* (you can extend
 * it with an annex) but it can't be the initiator: the action only
 * makes sense when the auxiliary annex is the deliberate selection.
 *
 * The pattern matches the names used by `LAYOUT_ROOM_PRESETS`
 * (kitchen, outdoor stage, annex) plus a few common manually-typed
 * variants (storage, washroom/restroom, corridor, hallway) so
 * coordinators can type a recognisable name and have the gating
 * just work.
 */
const AUXILIARY_ROOM_NAME_RE =
  /\b(kitchen|storage|washroom|restroom|corridor|hallway|annex|outdoor\s*stage|stage|prep|patio)\b/i

/**
 * Returns true when `frame` looks like an auxiliary space (kitchen,
 * storage, washroom, corridor, hallway, annex, outdoor stage). The
 * primary "Main Hall" returns false.
 */
export function isAuxiliaryRoom(frame: RoomFrame): boolean {
  return AUXILIARY_ROOM_NAME_RE.test(frame.name)
}

/**
 * Trace the four corners of `frame` as a closed polygon ring. The
 * order is `top-left → top-right → bottom-right → bottom-left → top-
 * left` so the ring is CW under canvas coordinates (y-down) — but the
 * clipping library normalizes winding, so the order is purely a
 * convention.
 */
export function frameToRing(frame: RoomFrame): Ring {
  const x0 = frame.originX
  const y0 = frame.originY
  const x1 = frame.originX + frame.widthFt
  const y1 = frame.originY + frame.lengthFt
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]
}

/** Convenience: a single-ring polygon for one frame. */
export function frameToPolygon(frame: RoomFrame): Polygon {
  return [frameToRing(frame)]
}

/**
 * Trace the four corners of a `PlacedObject`'s axis-aligned bounding
 * box as a closed polygon ring, ignoring rotation. We intentionally
 * use the AABB rather than the rotated rect because:
 *
 *   1. The dissolved zone perimeter is rectilinear by convention
 *      (rooms are always axis-aligned), and feeding rotated polygons
 *      into the union would emit angled outer edges that visually
 *      conflict with the rectilinear room frames.
 *   2. The user's mental model when annexing a stage to a room is
 *      "this rectangle of floor space joins the room", not "rotate
 *      the perimeter to follow the stage's tilt."
 *
 * If a future requirement calls for rotation-aware joining we can
 * swap this for the rotated 4-corner ring — `polygon-clipping`
 * handles non-axis-aligned polygons natively.
 */
export function objectToRing(obj: PlacedObject): Ring {
  const x0 = obj.x
  const y0 = obj.y
  const x1 = obj.x + obj.width
  const y1 = obj.y + obj.height
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]
}

/** Convenience: a single-ring polygon for one placed object. */
export function objectToPolygon(obj: PlacedObject): Polygon {
  return [objectToRing(obj)]
}

/** Rotation-aware footprint for boolean union / dissolved zones. */
export function structureFromPlacedObject(obj: PlacedObject): ArchitecturalStructure {
  const polygon = placedObjectFootprintRing(obj)
  return {
    id: obj.id,
    walls: [],
    polygon,
  }
}

/**
 * Treat a `PlacedObject` as if it were a `RoomFrame` for join-geometry
 * purposes. This lets the same overlap/touch predicates drive
 * mixed-type joins without duplicating the math.
 */
function objectAsFrameSurrogate(obj: PlacedObject): RoomFrame {
  return {
    id: obj.id,
    name: obj.label ?? obj.kind,
    originX: obj.x,
    originY: obj.y,
    widthFt: obj.width,
    lengthFt: obj.height,
  }
}

/**
 * Predicate: does the given joinable object overlap or touch the
 * frame within the standard tolerance? Used to surface the Join
 * action when an auxiliary fixture (e.g. an outdoor stage) is
 * positioned flush against the perimeter wall.
 */
export function objectFrameOverlapsOrTouches(
  obj: PlacedObject,
  frame: RoomFrame,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): boolean {
  return framesOverlapOrTouch(objectAsFrameSurrogate(obj), frame, epsilon)
}

/**
 * Predicate: do the two joinable objects overlap or touch? Used so
 * a coordinator can join two abutting stages into a single dissolved
 * "performance zone" without dragging them through a room first.
 */
export function joinableObjectsOverlapOrTouch(
  a: PlacedObject,
  b: PlacedObject,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): boolean {
  return framesOverlapOrTouch(
    objectAsFrameSurrogate(a),
    objectAsFrameSurrogate(b),
    epsilon
  )
}

/**
 * Compute the boolean union of an arbitrary list of room frames.
 * Returns the resulting MultiPolygon (empty when the input is empty).
 *
 * `polygon-clipping` accepts `union(geom, ...moreGeoms)` so we
 * unpack the array.
 */
export function unionFrames(frames: ReadonlyArray<RoomFrame>): MultiPolygon {
  if (frames.length === 0) return []
  const polygons = frames.map((f) =>
    normalizePolygonForUnion(frameToPolygon(f))
  )
  return guardedPolygonUnion(polygons)
}

/**
 * Pure rectangle-vs-rectangle overlap predicate using axis-aligned
 * bounding boxes — much faster than running the full clipper for the
 * hot path (selection + drag interactions hit this on every frame).
 *
 * Returns `true` when the two rectangles overlap with a non-zero
 * intersection area. Touching at an edge (zero-area overlap) returns
 * `false`; `framesTouch` covers that case separately.
 */
export function framesOverlap(
  a: RoomFrame,
  b: RoomFrame,
  epsilon = 1e-6
): boolean {
  const ax1 = a.originX + a.widthFt
  const ay1 = a.originY + a.lengthFt
  const bx1 = b.originX + b.widthFt
  const by1 = b.originY + b.lengthFt
  const overlapX = Math.min(ax1, bx1) - Math.max(a.originX, b.originX)
  const overlapY = Math.min(ay1, by1) - Math.max(a.originY, b.originY)
  return overlapX > epsilon && overlapY > epsilon
}

/**
 * Predicate: do the two frames touch along a wall segment (zero-area
 * overlap, but with a non-empty shared edge interval) within the
 * given tolerance?
 *
 * Used to surface the Join action when a coordinator parks a new
 * room flush against the primary perimeter — even if the corners
 * don't perfectly align, anything within `epsilon` (default 0.25 ft
 * = 3 inches) is considered touching.
 */
export function framesTouch(
  a: RoomFrame,
  b: RoomFrame,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): boolean {
  const ax0 = a.originX
  const ay0 = a.originY
  const ax1 = a.originX + a.widthFt
  const ay1 = a.originY + a.lengthFt
  const bx0 = b.originX
  const by0 = b.originY
  const bx1 = b.originX + b.widthFt
  const by1 = b.originY + b.lengthFt

  // Vertical contact: |ax1 - bx0| < eps OR |ax0 - bx1| < eps, with
  // a non-empty y-overlap.
  const xContact =
    Math.abs(ax1 - bx0) < epsilon || Math.abs(ax0 - bx1) < epsilon
  const yOverlap = Math.min(ay1, by1) - Math.max(ay0, by0)
  if (xContact && yOverlap > epsilon) return true

  // Horizontal contact: |ay1 - by0| < eps OR |ay0 - by1| < eps, with
  // a non-empty x-overlap.
  const yContact =
    Math.abs(ay1 - by0) < epsilon || Math.abs(ay0 - by1) < epsilon
  const xOverlap = Math.min(ax1, bx1) - Math.max(ax0, bx0)
  if (yContact && xOverlap > epsilon) return true

  return false
}

/**
 * Combined predicate: are the two frames either overlapping (true
 * 2D overlap) or touching (shared edge interval)? Either condition
 * makes them eligible for the Join action.
 */
export function framesOverlapOrTouch(
  a: RoomFrame,
  b: RoomFrame,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): boolean {
  return framesOverlap(a, b, epsilon) || framesTouch(a, b, epsilon)
}

/**
 * Group frames into connected components by overlap-or-touch. Each
 * returned subset is a list of frame ids that should be Join-able as
 * a single zone — the outer polygon traced by `polygon-clipping` over
 * any one component is guaranteed to be a single, hole-free outer
 * ring (because the components are by definition connected).
 *
 * Singleton components (rooms with no overlap/touch neighbours) are
 * filtered out — the user can't "Join" a lone room with itself.
 */
export function joinableGroups(
  frames: ReadonlyArray<RoomFrame>,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): string[][] {
  if (frames.length === 0) return []
  const parent = new Map<string, string>()
  for (const f of frames) parent.set(f.id, f.id)

  function find(id: string): string {
    let cur = id
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, parent.get(next)!)
      cur = parent.get(cur)!
    }
    return cur
  }
  function union(a: string, b: string): void {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (framesOverlapOrTouch(frames[i]!, frames[j]!, epsilon)) {
        union(frames[i]!.id, frames[j]!.id)
      }
    }
  }

  const buckets = new Map<string, string[]>()
  for (const f of frames) {
    const root = find(f.id)
    if (!buckets.has(root)) buckets.set(root, [])
    buckets.get(root)!.push(f.id)
  }
  return Array.from(buckets.values()).filter((group) => group.length > 1)
}

/**
 * Find every frame that overlaps or touches `target` — the seed set
 * for a "Join everything around me" action.
 */
export function neighborsOf(
  frames: ReadonlyArray<RoomFrame>,
  targetId: string,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): string[] {
  const target = frames.find((f) => f.id === targetId)
  if (!target) return []
  return frames
    .filter((f) => f.id !== targetId && framesOverlapOrTouch(target, f, epsilon))
    .map((f) => f.id)
}

/**
 * Discriminated union returned by `mixedNeighborsOf`. The caller
 * uses the `kind` tag to feed each neighbour to the right slot of
 * the `joinSelection` API (rooms vs joinable objects).
 */
export type JoinNeighbor =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }

/**
 * Mixed-type neighbour search: given a target frame OR object id,
 * returns every nearby room frame plus every nearby joinable object.
 * Skips objects whose kind is not in `JOINABLE_OBJECT_KINDS` and
 * always skips the target itself.
 *
 * This is the seed list the Join button uses when the active
 * selection is a Stage (or any other joinable object kind) — the
 * UI draws a single chip per neighbour and the action commits all
 * of them into one group.
 */
export function mixedNeighborsOf(
  target: { kind: 'room' | 'object'; id: string },
  frames: ReadonlyArray<RoomFrame>,
  objects: ReadonlyArray<PlacedObject>,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): JoinNeighbor[] {
  const out: JoinNeighbor[] = []

  // Resolve the target's bounding rectangle (RoomFrame surrogate
  // either way) so we can run the same predicates uniformly.
  let targetSurrogate: RoomFrame | null = null
  if (target.kind === 'room') {
    targetSurrogate = frames.find((f) => f.id === target.id) ?? null
  } else {
    const obj = objects.find((o) => o.id === target.id)
    if (obj && isJoinableObject(obj)) {
      targetSurrogate = objectAsFrameSurrogate(obj)
    }
  }
  if (!targetSurrogate) return out

  for (const f of frames) {
    if (target.kind === 'room' && f.id === target.id) continue
    if (framesOverlapOrTouch(targetSurrogate, f, epsilon)) {
      out.push({ kind: 'room', id: f.id })
    }
  }
  for (const obj of objects) {
    if (target.kind === 'object' && obj.id === target.id) continue
    if (!isJoinableObject(obj)) continue
    if (framesOverlapOrTouch(targetSurrogate, objectAsFrameSurrogate(obj), epsilon)) {
      out.push({ kind: 'object', id: obj.id })
    }
  }
  return out
}

/**
 * Given a list of frames (and optionally a list of joinable objects),
 * project the polygon-clipping union into a `JoinedZone` summary
 * (rings, AABB, area). This is the runtime data the canvas needs to
 * paint a single dissolved perimeter.
 *
 * `groupId`, `frameIds`, and `objectIds` are passed through verbatim
 * (callers decide how the group is identified persistently).
 *
 * Joinable objects (e.g. an outdoor stage annexed to the Main Hall)
 * contribute their AABB rectangle to the union — the same way a
 * room frame does — so the dissolved perimeter naturally wraps
 * around the stage's footprint. Non-joinable kinds passed in are
 * silently skipped to keep callers honest without needing a guard
 * at every site.
 */
export function buildJoinedZone(
  groupId: string,
  frames: ReadonlyArray<RoomFrame>,
  objects: ReadonlyArray<PlacedObject> = []
): JoinedZone | null {
  const eligibleObjects = objects.filter(isJoinableObject)
  if (frames.length === 0 && eligibleObjects.length === 0) return null
  const frameIds = frames.map((f) => f.id)
  const objectIds = eligibleObjects.map((o) => o.id)

  const structures = [
    ...frames.map((f) =>
      structureFromRect(f.id, f.originX, f.originY, f.widthFt, f.lengthFt)
    ),
    ...eligibleObjects.map((o) => structureFromPlacedObject(o)),
  ]

  const merged = mergeAdjacentStructuresMany(structures, DEFAULT_TOUCH_EPSILON_FT)
  if (!merged || merged.paths.length === 0) return null

  const rawRings = pathsToClosedRings(merged.paths) as Ring[]
  const anchorPoints = [
    ...frames.map((f) => ({
      x: f.originX + f.widthFt / 2,
      y: f.originY + f.lengthFt / 2,
    })),
    ...eligibleObjects.map((o) => ({
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
    })),
  ]
  const rings = ensurePlacementOuterRings(
    rawRings,
    interiorAnchorFromBounds(anchorPoints)
  )

  return {
    groupId,
    frameIds,
    objectIds,
    rings,
    perimeterWalls: merged.activeWalls,
    aabb: merged.aabb,
    areaSqFt: merged.areaSqFt,
  }
}

/** Boolean-union perimeter for overlap/touch groups without `joinGroupId`. */
export interface AutoUnionZone {
  zoneId: string
  frameIds: string[]
  rings: Ring[]
  perimeterWalls: WallSegment2[]
  aabb: RoomJoinBbox
}

function frameUsesStoredUnionPerimeter(frame: RoomFrame): boolean {
  return Boolean(frame.perimeterRing && frame.perimeterRing.length > 5)
}

/**
 * Build dissolved perimeters for rooms that overlap or touch but were
 * not explicitly joined. Interior walls are removed via polygon union.
 */
export function buildAutoUnionZones(
  frames: ReadonlyArray<RoomFrame>,
  excludeFrameIds: ReadonlySet<string> = new Set(),
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): AutoUnionZone[] {
  const eligible = frames.filter(
    (f) =>
      !f.mergedIntoObjectId &&
      !f.joinGroupId &&
      !frameUsesStoredUnionPerimeter(f) &&
      !excludeFrameIds.has(f.id)
  )
  const zones: AutoUnionZone[] = []
  for (const group of joinableGroups(eligible, epsilon)) {
    if (group.length < 2) continue
    const members = group
      .map((id) => eligible.find((f) => f.id === id))
      .filter((f): f is RoomFrame => f != null)
    if (members.length < 2) continue
    const zoneId = `auto-union:${[...group].sort().join('+')}`
    const zone = buildJoinedZone(zoneId, members)
    if (!zone) continue
    zones.push({
      zoneId,
      frameIds: group,
      rings: zone.rings,
      perimeterWalls: zone.perimeterWalls,
      aabb: zone.aabb,
    })
  }
  return zones
}

/** Hit-test the visible union perimeter / room walls (not full AABB). */
export function hitTestRoomStroke(
  frames: ReadonlyArray<RoomFrame>,
  p: { x: number; y: number },
  tolerance: number,
  excludeFrameIds: ReadonlySet<string> = new Set()
): string | null {
  const autoZones = buildAutoUnionZones(frames, excludeFrameIds)
  const autoUnionIds = new Set<string>()
  for (const zone of autoZones) {
    for (const id of zone.frameIds) autoUnionIds.add(id)
    for (const [a, b] of zone.perimeterWalls) {
      if (pointDistanceToSegment(p, a[0], a[1], b[0], b[1]) <= tolerance) {
        return zone.frameIds[0] ?? null
      }
    }
  }

  const wallSegments = computeRoomWallSegments(frames)
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]!
    if (frame.mergedIntoObjectId) continue
    if (autoUnionIds.has(frame.id)) continue
    if (excludeFrameIds.has(frame.id)) continue
    const visibleEdges = wallSegments.get(frame.id)
    if (pointHitsFrameStroke(frame, p, tolerance, visibleEdges)) {
      return frame.id
    }
  }
  return null
}

/**
 * Shoelace formula for a closed ring. Sign is meaningful (positive
 * for CCW, negative for CW under screen coords) so callers that
 * care about winding can read it; `buildJoinedZone` takes |area|.
 */
function signedRingArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!
    const b = ring[i + 1]!
    sum += (a[0] * b[1] - b[0] * a[1])
  }
  return sum / 2
}

/**
 * Intersection check between a `RoomFrame` and the union of all
 * frames listed in `others`. Returns true when `target` overlaps the
 * union with non-zero area — the trigger condition for the Join CTA
 * "this asset overlaps the primary perimeter wall bounding box".
 *
 * Built on the clipper rather than AABB-only because callers may
 * eventually want to test an L-shaped joined zone, not just a single
 * rectangle.
 */
export function frameOverlapsUnion(
  target: RoomFrame,
  others: ReadonlyArray<RoomFrame>
): boolean {
  if (others.length === 0) return false
  const union = unionFrames(others)
  if (union.length === 0) return false
  const targetPoly: Polygon = frameToPolygon(target)
  const intersection = polygonClipping.intersection(
    targetPoly as Geom,
    union as Geom
  )
  return intersection.length > 0
}

/**
 * Bbox helper used by callers that want to know what the canvas
 * extents need to grow to in order to fully contain a joined zone.
 */
export function aabbOfRings(rings: ReadonlyArray<Ring>): RoomJoinBbox | null {
  if (rings.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

/**
 * True when every room in `roomIds` belongs to one overlap/touch
 * connected component (for validating multi-select Join).
 */
export function roomIdsFormConnectedComponent(
  roomIds: ReadonlyArray<string>,
  frames: ReadonlyArray<RoomFrame>,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): boolean {
  if (roomIds.length < 2) return false
  const idSet = new Set(roomIds)
  const members = frames.filter((f) => idSet.has(f.id))
  if (members.length < 2) return false
  const groups = joinableGroups(members, epsilon)
  return groups.some((g) => g.length === members.length)
}
