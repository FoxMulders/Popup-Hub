/**
 * Winding-safe boolean union for `polygon-clipping`.
 *
 * Outer rings must be counter-clockwise; holes clockwise. Wrong winding
 * can make the clipper treat a solid extension as a subtractive hole.
 */

import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping'
import polygonClippingDefault from 'polygon-clipping'

type Geom = Polygon | MultiPolygon
type PolygonClipping = {
  union: (geom: Geom, ...geoms: Geom[]) => MultiPolygon
}
const polygonClipping = polygonClippingDefault as unknown as PolygonClipping

/** Positive signed area ⇒ CCW (GeoJSON / polygon-clipping exterior convention). */
const OUTER_CCW_SIGN = 1
/** Negative signed area ⇒ CW hole convention. */
const HOLE_CW_SIGN = -1

export function signedRingArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!
    const b = ring[i + 1]!
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return sum / 2
}

function ringIsClosed(ring: Ring): boolean {
  if (ring.length < 2) return false
  const first = ring[0]!
  const last = ring[ring.length - 1]!
  return first[0] === last[0] && first[1] === last[1]
}

export function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring
  if (ringIsClosed(ring)) return ring
  const first = ring[0]!
  return [...ring, [first[0], first[1]]]
}

/** Reverse vertex order while preserving a closed ring. */
export function reverseRing(ring: Ring): Ring {
  if (ring.length < 2) return ring
  const closed = ringIsClosed(ring)
  const open = closed ? ring.slice(0, -1) : [...ring]
  open.reverse()
  if (open.length === 0) return ring
  const first = open[0]!
  return closed ? [...open, [first[0], first[1]]] : open
}

/** Force an exterior ring to counter-clockwise (positive signed area). */
export function ensureOuterRingCCW(ring: Ring): Ring {
  const closed = closeRing(ring)
  if (closed.length < 4) return closed
  const area = signedRingArea(closed)
  if (area * OUTER_CCW_SIGN < 0) return reverseRing(closed)
  return closed
}

/** Force a hole ring to clockwise (negative signed area). */
export function ensureHoleRingCW(ring: Ring): Ring {
  const closed = closeRing(ring)
  if (closed.length < 4) return closed
  const area = signedRingArea(closed)
  if (area * HOLE_CW_SIGN > 0) return reverseRing(closed)
  return closed
}

/** Normalize one polygon (outer CCW, holes CW) before feeding the clipper. */
export function normalizePolygonForUnion(polygon: Polygon): Polygon {
  if (polygon.length === 0) return polygon
  const outer = ensureOuterRingCCW(polygon[0]!)
  const holes = polygon.slice(1).map((h) => ensureHoleRingCW(h))
  return [outer, ...holes]
}

/** Flip every ring in each polygon (retry path when union inverts). */
export function flipAllPolygonWinding(polygons: ReadonlyArray<Polygon>): Polygon[] {
  return polygons.map((poly) => poly.map((ring) => reverseRing(closeRing(ring))))
}

function outerRingArea(poly: Polygon): number {
  const outer = poly[0]
  if (!outer || outer.length < 4) return 0
  return Math.abs(signedRingArea(outer))
}

/** Sum of absolute outer-ring areas across all input polygons. */
export function sumInputPolygonsArea(polygons: ReadonlyArray<Polygon>): number {
  return polygons.reduce((sum, poly) => sum + outerRingArea(poly), 0)
}

/** Largest single-participant outer-ring area. */
export function maxInputPolygonArea(polygons: ReadonlyArray<Polygon>): number {
  let max = 0
  for (const poly of polygons) {
    const a = outerRingArea(poly)
    if (a > max) max = a
  }
  return max
}

/** Total absolute area of all outer rings in a union result. */
export function multiPolygonOuterArea(mp: MultiPolygon): number {
  let area = 0
  for (const poly of mp) {
    const outer = poly[0]
    if (!outer || outer.length < 4) continue
    area += Math.abs(signedRingArea(outer))
  }
  return area
}

export function normalizeMultiPolygonOutput(mp: MultiPolygon): MultiPolygon {
  return mp.map((poly) => normalizePolygonForUnion(poly))
}

function nearlyCollinear(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  epsilon: number
): boolean {
  const cross =
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return Math.abs(cross) <= epsilon
}

/**
 * Remove collinear vertices from a closed ring so perimeter walkers and
 * auto-arrange do not stall on dissolved union stair-steps.
 */
export function simplifyRingCollinear(
  ring: Ring,
  epsilon = 1e-4
): Ring {
  const closed = closeRing(ring)
  if (closed.length < 5) return closed
  const open = closed.slice(0, -1)
  if (open.length < 3) return closed

  const simplified: Array<[number, number]> = []
  const n = open.length
  for (let i = 0; i < n; i++) {
    const prev = open[(i - 1 + n) % n]!
    const cur = open[i]!
    const next = open[(i + 1) % n]!
    if (!nearlyCollinear(prev, cur, next, epsilon)) {
      simplified.push([cur[0], cur[1]])
    }
  }
  if (simplified.length < 3) return closed
  const first = simplified[0]!
  return [...simplified, [first[0], first[1]]]
}

function runUnion(normalized: Polygon[]): MultiPolygon {
  if (normalized.length === 0) return []
  if (normalized.length === 1) return [normalized[0]!]
  const [first, ...rest] = normalized
  return polygonClipping.union(first as Geom, ...(rest as Geom[]))
}

/**
 * True when the union result looks like a subtractive inversion (output
 * area collapsed relative to participants).
 */
export function unionLooksInverted(
  outputArea: number,
  participantMaxArea: number,
  participantSumArea: number
): boolean {
  if (outputArea <= 0) return true
  if (participantMaxArea > 0 && outputArea < participantMaxArea * 0.95) {
    return true
  }
  if (
    participantSumArea > 0 &&
    outputArea < participantSumArea * 0.35
  ) {
    return true
  }
  return false
}

/**
 * Boolean union with enforced input winding and inversion retry.
 */
export function guardedPolygonUnion(polygons: Polygon[]): MultiPolygon {
  if (polygons.length === 0) return []
  const normalized = polygons.map((p) => normalizePolygonForUnion(p))
  if (normalized.length === 1) {
    return normalizeMultiPolygonOutput([normalized[0]!])
  }

  const participantMax = maxInputPolygonArea(normalized)
  const participantSum = sumInputPolygonsArea(normalized)

  let mp = runUnion(normalized)
  let outArea = multiPolygonOuterArea(mp)

  if (unionLooksInverted(outArea, participantMax, participantSum)) {
    const flipped = flipAllPolygonWinding(normalized)
    const retry = runUnion(flipped)
    const retryArea = multiPolygonOuterArea(retry)
    if (retryArea > outArea) {
      mp = retry
      outArea = retryArea
    }
  }

  return normalizeMultiPolygonOutput(mp)
}
