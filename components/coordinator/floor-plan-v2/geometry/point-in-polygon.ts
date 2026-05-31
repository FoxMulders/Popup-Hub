/**
 * Ray-casting point-in-polygon (even-odd rule). Pure math, deterministic.
 */

export type RingPoint = readonly [number, number]

export function openRingVertices(
  ring: ReadonlyArray<RingPoint>
): Array<{ x: number; y: number }> {
  if (ring.length === 0) return []
  const pts = ring.map(([x, y]) => ({ x, y }))
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (first.x === last.x && first.y === last.y) {
    return pts.slice(0, -1)
  }
  return pts
}

/** Even-odd ray cast — true when `p` lies inside a closed ring. */
export function pointInPolygon(
  p: { x: number; y: number },
  ring: ReadonlyArray<RingPoint>
): boolean {
  const verts = openRingVertices(ring)
  const n = verts.length
  if (n < 3) return false

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = verts[i]!.x
    const yi = verts[i]!.y
    const xj = verts[j]!.x
    const yj = verts[j]!.y
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInAnyRing(
  p: { x: number; y: number },
  rings: ReadonlyArray<ReadonlyArray<RingPoint>>
): boolean {
  for (const ring of rings) {
    if (pointInPolygon(p, ring)) return true
  }
  return false
}

export function ringCentroid(ring: ReadonlyArray<RingPoint>): {
  x: number
  y: number
} {
  const verts = openRingVertices(ring)
  if (verts.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const v of verts) {
    sx += v.x
    sy += v.y
  }
  return { x: sx / verts.length, y: sy / verts.length }
}

export function ringBounds(ring: ReadonlyArray<RingPoint>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const verts = openRingVertices(ring)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const v of verts) {
    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}
