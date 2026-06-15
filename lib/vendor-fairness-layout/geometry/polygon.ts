import {
  bbox as turfBbox,
  booleanPointInPolygon,
  point as turfPoint,
  polygon as turfPolygon,
} from '@turf/turf'
import type { Point, Rect } from '../types'

function closeRing(boundary: Point[]): [number, number][] {
  if (boundary.length < 3) return []
  const coords = boundary.map((p) => [p.x, p.y] as [number, number])
  const first = coords[0]!
  const last = coords[coords.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return coords
}

export function roomPolygon(boundary: Point[]) {
  return turfPolygon([closeRing(boundary)])
}

export function pointInRoom(p: Point, boundary: Point[]): boolean {
  if (boundary.length < 3) return false
  return booleanPointInPolygon(turfPoint([p.x, p.y]), roomPolygon(boundary))
}

export function roomBoundingBox(boundary: Point[]): Rect {
  if (boundary.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const [minX, minY, maxX, maxY] = turfBbox(roomPolygon(boundary))
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/** Inset polygon toward centroid by fixed distance (approximate via scale). */
export function insetBoundary(boundary: Point[], insetFt: number): Point[] {
  if (boundary.length < 3 || insetFt <= 0) return boundary.map((p) => ({ ...p }))
  const cx = boundary.reduce((s, p) => s + p.x, 0) / boundary.length
  const cy = boundary.reduce((s, p) => s + p.y, 0) / boundary.length
  const maxDist = Math.max(
    ...boundary.map((p) => Math.hypot(p.x - cx, p.y - cy))
  )
  if (maxDist <= insetFt) return boundary.map((p) => ({ ...p }))
  const scale = (maxDist - insetFt) / maxDist
  return boundary.map((p) => ({
    x: cx + (p.x - cx) * scale,
    y: cy + (p.y - cy) * scale,
  }))
}

export function allPointsInRoom(points: Point[], boundary: Point[]): boolean {
  return points.every((p) => pointInRoom(p, boundary))
}

/** Horizontal chord inside a simple polygon at y (inset from walls). */
export function horizontalSpanAtY(
  boundary: Point[],
  y: number,
  insetFt: number
): { left: number; right: number } | null {
  if (boundary.length < 3) return null
  const xs: number[] = []
  const n = boundary.length
  for (let i = 0; i < n; i++) {
    const a = boundary[i]!
    const b = boundary[(i + 1) % n]!
    const dy = b.y - a.y
    if (Math.abs(dy) < 1e-9) continue
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const t = (y - a.y) / dy
      xs.push(a.x + t * (b.x - a.x))
    }
  }
  if (xs.length < 2) return null
  xs.sort((a, b) => a - b)
  const left = xs[0]! + insetFt
  const right = xs[xs.length - 1]! - insetFt
  if (right - left < insetFt * 2) return null
  return { left, right }
}
