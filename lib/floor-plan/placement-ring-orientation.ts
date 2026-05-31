/**
 * Placement-ring winding for canvas-global feet (y-down).
 *
 * Rectangular room frames use a positive shoelace area; ray-cast and
 * winding tests must use the same outer-ring orientation after boolean
 * union so merged interiors register as valid drop zones.
 */

import type { Ring } from 'polygon-clipping'
import {
  closeRing,
  reverseRing,
  signedRingArea,
  simplifyRingCollinear,
} from '@/lib/floor-plan/polygon-clipping-union'

export type PlacementPoint = { x: number; y: number }

/** Non-zero winding — matches `frameToRing` / positive-area outers on the canvas. */
export function pointInsideOuterRing(
  p: PlacementPoint,
  ring: Ring,
  epsilon = 1e-6
): boolean {
  const closed = closeRing(ring)
  const pts =
    closed.length > 1 &&
    closed[0]![0] === closed[closed.length - 1]![0] &&
    closed[0]![1] === closed[closed.length - 1]![1]
      ? closed.slice(0, -1)
      : [...closed]
  if (pts.length < 3) return false

  let winding = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    if (a[1] <= p.y) {
      if (b[1] > p.y && (b[0] - a[0]) * (p.y - a[1]) - (p.x - a[0]) * (b[1] - a[1]) > epsilon) {
        winding++
      }
    } else if (b[1] <= p.y) {
      if ((b[0] - a[0]) * (p.y - a[1]) - (p.x - a[0]) * (b[1] - a[1]) < -epsilon) {
        winding--
      }
    }
  }
  return winding !== 0
}

/**
 * After boolean union: simplify collinear verts, then orient the outer
 * ring so `interiorAnchor` lies inside (fallback: positive signed area
 * like `frameToRing`).
 */
export function ensurePlacementOuterRing(
  ring: Ring,
  interiorAnchor?: PlacementPoint
): Ring {
  const closed = simplifyRingCollinear(closeRing(ring))
  if (closed.length < 4) return closed

  const forward = closed
  const reversed = reverseRing(closed)

  if (interiorAnchor) {
    const fwdInside = pointInsideOuterRing(interiorAnchor, forward)
    const revInside = pointInsideOuterRing(interiorAnchor, reversed)
    if (fwdInside && !revInside) return forward
    if (revInside && !fwdInside) return reversed
  }

  if (signedRingArea(forward) < 0) return reversed
  return forward
}

export function ensurePlacementOuterRings(
  rings: ReadonlyArray<Ring>,
  interiorAnchor?: PlacementPoint
): Ring[] {
  return rings.map((r) => ensurePlacementOuterRing(r, interiorAnchor))
}

/** Centroid of merge participants — reliable interior probe for unions. */
export function interiorAnchorFromBounds(
  points: ReadonlyArray<PlacementPoint>
): PlacementPoint | undefined {
  if (points.length === 0) return undefined
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}
