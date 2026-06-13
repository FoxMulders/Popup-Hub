/**
 * Polygon room editing — projection, insertion, validation, AABB sync.
 * Pure math; no React or DOM.
 */

import { pointDistanceToSegment, type Point } from '../interactions/geometry'
import { frameToRing } from '../state/placement-surface'
import {
  openRingVertices,
  ringBounds,
  type RingPoint,
} from './point-in-polygon'
import type { RoomFrame } from '../state/types'

export type { RingPoint }

/** Minimum signed area (sq ft) for a valid room polygon. */
export const MIN_ROOM_AREA_SQFT = 100

const EPS = 1e-9

export function openVertices(
  ring: ReadonlyArray<RingPoint>
): Array<{ x: number; y: number }> {
  return openRingVertices(ring)
}

/** Append closing point when the ring is open. */
export function closeRing(
  vertices: ReadonlyArray<{ x: number; y: number }>
): Array<[number, number]> {
  if (vertices.length === 0) return []
  const out = vertices.map((v) => [v.x, v.y] as [number, number])
  const first = out[0]!
  const last = out[out.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]])
  }
  return out
}

export function ringFromRect(frame: RoomFrame): Array<[number, number]> {
  return frameToRing(frame).map(([x, y]) => [x, y] as [number, number])
}

export function syncFrameBoundsFromRing(
  frame: RoomFrame,
  ring: ReadonlyArray<RingPoint>
): RoomFrame {
  const b = ringBounds(ring)
  return {
    ...frame,
    originX: b.minX,
    originY: b.minY,
    widthFt: Math.max(1e-6, b.maxX - b.minX),
    lengthFt: Math.max(1e-6, b.maxY - b.minY),
    perimeterRing: ring,
  }
}

export function projectPointOntoSegment(
  p: Point,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { point: Point; t: number; distance: number } {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < EPS) {
    return {
      point: { x: ax, y: ay },
      t: 0,
      distance: Math.hypot(p.x - ax, p.y - ay),
    }
  }
  const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / lenSq))
  const point = { x: ax + t * dx, y: ay + t * dy }
  return {
    point,
    t,
    distance: Math.hypot(p.x - point.x, p.y - point.y),
  }
}

export interface EdgeHit {
  edgeIndex: number
  distance: number
  projection: Point
}

/** Nearest perimeter edge to `p` within `toleranceFt`. */
export function nearestEdgeHit(
  p: Point,
  ring: ReadonlyArray<RingPoint>,
  toleranceFt: number
): EdgeHit | null {
  const verts = openVertices(ring)
  if (verts.length < 2) return null
  let best: EdgeHit | null = null
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!
    const b = verts[(i + 1) % verts.length]!
    const proj = projectPointOntoSegment(p, a.x, a.y, b.x, b.y)
    if (proj.distance <= toleranceFt && (!best || proj.distance < best.distance)) {
      best = { edgeIndex: i, distance: proj.distance, projection: proj.point }
    }
  }
  return best
}

/** Nearest open-ring vertex to `p` within `toleranceFt`. */
export function nearestVertexHit(
  p: Point,
  ring: ReadonlyArray<RingPoint>,
  toleranceFt: number
): number | null {
  const verts = openVertices(ring)
  let bestIdx: number | null = null
  let bestDist = toleranceFt
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i]!
    const d = Math.hypot(p.x - v.x, p.y - v.y)
    if (d <= bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

export function insertVertexOnEdge(
  ring: ReadonlyArray<RingPoint>,
  edgeIndex: number,
  point: Point
): Array<[number, number]> {
  const verts = openVertices(ring)
  if (verts.length < 2 || edgeIndex < 0 || edgeIndex >= verts.length) {
    return [...ring] as Array<[number, number]>
  }
  const insertAt = edgeIndex + 1
  const next = [
    ...verts.slice(0, insertAt).map((v) => [v.x, v.y] as [number, number]),
    [point.x, point.y] as [number, number],
    ...verts.slice(insertAt).map((v) => [v.x, v.y] as [number, number]),
  ]
  return closeRing(next.map(([x, y]) => ({ x, y })))
}

export function moveVertex(
  ring: ReadonlyArray<RingPoint>,
  index: number,
  point: Point
): Array<[number, number]> {
  const verts = openVertices(ring)
  if (index < 0 || index >= verts.length) return [...ring] as Array<[number, number]>
  const next = verts.map((v, i) =>
    i === index ? { x: point.x, y: point.y } : { x: v.x, y: v.y }
  )
  return closeRing(next)
}

export function translateRing(
  ring: ReadonlyArray<RingPoint>,
  dx: number,
  dy: number
): Array<[number, number]> {
  return ring.map(([x, y]) => [x + dx, y + dy] as [number, number])
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

function orientation(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): number {
  const v = cross(bx - ax, by - ay, cx - ax, cy - ay)
  if (Math.abs(v) < EPS) return 0
  return v > 0 ? 1 : -1
}

function onSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  return (
    Math.min(ax, bx) - EPS <= cx &&
    cx <= Math.max(ax, bx) + EPS &&
    Math.min(ay, by) - EPS <= cy &&
    cy <= Math.max(ay, by) + EPS
  )
}

/** True when segments (a→b) and (c→d) intersect at a single interior point. */
export function segmentsIntersectProper(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy)
  const o2 = orientation(ax, ay, bx, by, dx, dy)
  const o3 = orientation(cx, cy, dx, dy, ax, ay)
  const o4 = orientation(cx, cy, dx, dy, bx, by)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true

  return false
}

function signedPolygonArea(vertices: ReadonlyArray<{ x: number; y: number }>): number {
  let sum = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!
    const b = vertices[(i + 1) % n]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** Reject bow-tie / hourglass shapes and degenerate polygons. */
export function isSimplePolygon(
  vertices: ReadonlyArray<{ x: number; y: number }>
): boolean {
  const n = vertices.length
  if (n < 3) return false
  if (Math.abs(signedPolygonArea(vertices)) < MIN_ROOM_AREA_SQFT) return false

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i]!
    const a2 = vertices[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges and edges sharing a vertex.
      if (j === i) continue
      if (j === (i + 1) % n) continue
      if ((j + 1) % n === i) continue
      const b1 = vertices[j]!
      const b2 = vertices[(j + 1) % n]!
      if (segmentsIntersectProper(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) {
        return false
      }
    }
  }
  return true
}

const AXIS_EPS = 0.01

/** True when ring is a 4-vertex axis-aligned rectangle. */
export function isAxisAlignedRect(ring: ReadonlyArray<RingPoint>): boolean {
  const verts = openVertices(ring)
  if (verts.length !== 4) return false
  const xs = verts.map((v) => v.x)
  const ys = verts.map((v) => v.y)
  const uniqueX = [...new Set(xs.map((x) => Math.round(x / AXIS_EPS) * AXIS_EPS))]
  const uniqueY = [...new Set(ys.map((y) => Math.round(y / AXIS_EPS) * AXIS_EPS))]
  if (uniqueX.length !== 2 || uniqueY.length !== 2) return false
  for (const v of verts) {
    const onVertical =
      Math.abs(v.x - uniqueX[0]!) < AXIS_EPS || Math.abs(v.x - uniqueX[1]!) < AXIS_EPS
    const onHorizontal =
      Math.abs(v.y - uniqueY[0]!) < AXIS_EPS || Math.abs(v.y - uniqueY[1]!) < AXIS_EPS
    if (!onVertical || !onHorizontal) return false
  }
  return true
}

/** Resolve the editable ring for a frame (ring or rect-derived). */
export function editableRingForFrame(frame: RoomFrame): Array<[number, number]> {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return [...frame.perimeterRing] as Array<[number, number]>
  }
  return ringFromRect(frame)
}

/** Hit-test distance from point to ring edge (exported for tests). */
export function distanceToRingEdge(p: Point, ring: ReadonlyArray<RingPoint>): number {
  const hit = nearestEdgeHit(p, ring, Number.POSITIVE_INFINITY)
  return hit?.distance ?? Number.POSITIVE_INFINITY
}

export { pointDistanceToSegment }
