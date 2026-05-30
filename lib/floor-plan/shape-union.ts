/**
 * Boolean union of placed-object footprints for canvas Merge.
 */

import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping'
import polygonClippingDefault from 'polygon-clipping'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  objectCenter,
  rotatePointAround,
  type Point,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'

type Geom = Polygon | MultiPolygon
type PolygonClipping = {
  union: (geom: Geom, ...geoms: Geom[]) => MultiPolygon
}
const polygonClipping = polygonClippingDefault as unknown as PolygonClipping

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
  return ring
}

function signedRingArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!
    const b = ring[i + 1]!
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return sum / 2
}

/**
 * Union two or more placed objects into one outer perimeter (no interior edges).
 */
export function unionPlacedObjectFootprints(
  objects: ReadonlyArray<PlacedObject>
): ShapeUnionResult | null {
  if (objects.length < 2) return null
  const polygons: Polygon[] = objects.map((o) => [placedObjectFootprintRing(o)])
  const [first, ...rest] = polygons
  const mp =
    rest.length === 0
      ? ([first!] as MultiPolygon)
      : polygonClipping.union(first as Geom, ...(rest as Geom[]))

  const rings: Ring[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let area = 0

  for (const polygon of mp) {
    const outer = polygon[0]
    if (!outer || outer.length < 4) continue
    rings.push(outer)
    area += Math.abs(signedRingArea(outer))
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
