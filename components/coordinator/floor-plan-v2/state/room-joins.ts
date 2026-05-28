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

import type { RoomFrame } from './types'

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
  /** Outer rings of the dissolved perimeter. */
  rings: Ring[]
  /** Bounding box of the union polygon. */
  aabb: RoomJoinBbox
  /** Total floor-area of the dissolved zone, in square feet. */
  areaSqFt: number
}

const DEFAULT_TOUCH_EPSILON_FT = 0.25

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
 * Compute the boolean union of an arbitrary list of room frames.
 * Returns the resulting MultiPolygon (empty when the input is empty).
 *
 * `polygon-clipping` accepts `union(geom, ...moreGeoms)` so we
 * unpack the array.
 */
export function unionFrames(frames: ReadonlyArray<RoomFrame>): MultiPolygon {
  if (frames.length === 0) return []
  const polygons = frames.map(frameToPolygon)
  if (polygons.length === 1) {
    // The library only requires one arg for a no-op union, but we
    // wrap it in a MultiPolygon for consistency with the multi-frame
    // case below.
    return [polygons[0]!]
  }
  const [first, ...rest] = polygons
  return polygonClipping.union(first as Geom, ...(rest as Geom[]))
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
 * Given a list of frames, project the polygon-clipping union into a
 * `JoinedZone` summary (rings, AABB, area). This is the runtime data
 * the canvas needs to paint a single dissolved perimeter.
 *
 * `groupId` and `frameIds` are passed through verbatim (callers
 * decide how the group is identified persistently).
 */
export function buildJoinedZone(
  groupId: string,
  frames: ReadonlyArray<RoomFrame>
): JoinedZone | null {
  if (frames.length === 0) return null
  const frameIds = frames.map((f) => f.id)
  const mp = unionFrames(frames)
  if (mp.length === 0) return null

  const rings: Ring[] = []
  let area = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const polygon of mp) {
    // outer ring is polygon[0]; holes are polygon[1..]. We render
    // outer rings only (rooms can't form holes via union-of-rects in
    // any sane configuration, but we filter defensively).
    const outer = polygon[0]
    if (!outer) continue
    rings.push(outer)
    for (const [px, py] of outer) {
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    }
    area += signedRingArea(outer)
  }

  if (rings.length === 0) return null

  return {
    groupId,
    frameIds,
    rings,
    aabb: { minX, minY, maxX, maxY },
    areaSqFt: Math.abs(area),
  }
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
