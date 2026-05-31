/**
 * Boolean union of placed-object footprints for canvas Merge.
 */

import type { Polygon, Ring } from 'polygon-clipping'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  objectCenter,
  rotatePointAround,
  type Point,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  ensureOuterRingCCW,
  guardedPolygonUnion,
  multiPolygonOuterArea,
  normalizePolygonForUnion,
  signedRingArea,
} from '@/lib/floor-plan/polygon-clipping-union'

export interface ShapeUnionResult {
  /** Closed rings in global canvas feet. */
  rings: Ring[]
  aabb: { minX: number; minY: number; maxX: number; maxY: number }
  areaSqFt: number
}

function footprintCorners(obj: PlacedObject): Point[] {
  return [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ]
}

/** Closed ring for one object (rotation-aware). */
export function placedObjectFootprintRing(obj: PlacedObject): Ring {
  const center = objectCenter(obj)
  const corners = footprintCorners(obj)
  const pts = obj.rotation
    ? corners.map((c) => rotatePointAround(c, center, obj.rotation))
    : corners
  const ring: Ring = pts.map((p) => [p.x, p.y] as [number, number])
  const first = ring[0]!
  ring.push([first[0], first[1]])
  return ensureOuterRingCCW(ring)
}

/**
 * Union two or more placed objects into one outer perimeter (no interior edges).
 */
export function unionPlacedObjectFootprints(
  objects: ReadonlyArray<PlacedObject>
): ShapeUnionResult | null {
  if (objects.length < 2) return null
  const polygons: Polygon[] = objects.map((o) =>
    normalizePolygonForUnion([placedObjectFootprintRing(o)])
  )
  const mp = guardedPolygonUnion(polygons)
  const area = multiPolygonOuterArea(mp)

  const rings: Ring[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const polygon of mp) {
    const outer = polygon[0]
    if (!outer || outer.length < 4) continue
    rings.push(ensureOuterRingCCW(outer))
    for (const [px, py] of outer) {
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    }
  }

  if (rings.length === 0 || !Number.isFinite(minX)) return null
  return {
    rings,
    aabb: { minX, minY, maxX, maxY },
    areaSqFt: area,
  }
}

/** Convert global rings to coordinates local to `(originX, originY)`. */
export function ringsToLocalSpace(
  rings: ReadonlyArray<Ring>,
  originX: number,
  originY: number
): number[][][] {
  return rings.map((ring) =>
    ring.map(([px, py]) => [px - originX, py - originY])
  )
}

export function ringsToSvgPathD(
  localRings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  pxPerFt: number
): string {
  const segments: string[] = []
  for (const ring of localRings) {
    if (ring.length === 0) continue
    const [first, ...rest] = ring
    segments.push(`M ${first![0] * pxPerFt} ${first![1] * pxPerFt}`)
    for (const [px, py] of rest) {
      segments.push(`L ${px * pxPerFt} ${py * pxPerFt}`)
    }
    segments.push('Z')
  }
  return segments.join(' ')
}
