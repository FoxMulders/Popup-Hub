import type { Point, Rect, RotatedBooth } from '../types'

export function boothCenter(b: Pick<RotatedBooth, 'x' | 'y' | 'width' | 'height'>): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (deg === 0) return { ...p }
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function boothCorners(b: RotatedBooth): Point[] {
  const c = boothCenter(b)
  const raw = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ]
  return raw.map((p) => rotatePoint(p, c, b.rotation))
}

export function rotatedAabb(b: RotatedBooth): Rect {
  const corners = boothCorners(b)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of corners) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function project(corners: Point[], axis: Point): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const p of corners) {
    const dot = p.x * axis.x + p.y * axis.y
    if (dot < min) min = dot
    if (dot > max) max = dot
  }
  return [min, max]
}

function overlap1D(a: [number, number], b: [number, number], epsilon = 1e-6): boolean {
  return a[1] > b[0] + epsilon && b[1] > a[0] + epsilon
}

/** Separating axis theorem — true when booths overlap. */
export function boothsOverlap(a: RotatedBooth, b: RotatedBooth, clearanceFt = 0): boolean {
  const ca = boothCorners(a)
  const cb = boothCorners(b)
  const axes: Point[] = []
  for (let i = 0; i < 4; i++) {
    const p0 = ca[i]!
    const p1 = ca[(i + 1) % 4]!
    const edge = { x: p1.x - p0.x, y: p1.y - p0.y }
    const len = Math.hypot(edge.x, edge.y) || 1
    axes.push({ x: -edge.y / len, y: edge.x / len })
  }
  for (let i = 0; i < 4; i++) {
    const p0 = cb[i]!
    const p1 = cb[(i + 1) % 4]!
    const edge = { x: p1.x - p0.x, y: p1.y - p0.y }
    const len = Math.hypot(edge.x, edge.y) || 1
    axes.push({ x: -edge.y / len, y: edge.x / len })
  }
  const pad = clearanceFt
  for (const axis of axes) {
    const pa = project(ca, axis)
    const pb = project(cb, axis)
    if (!overlap1D([pa[0] - pad, pa[1] + pad], [pb[0] - pad, pb[1] + pad])) {
      return false
    }
  }
  return true
}

export function anyBoothOverlap(booths: RotatedBooth[], clearanceFt = 0): boolean {
  for (let i = 0; i < booths.length; i++) {
    for (let j = i + 1; j < booths.length; j++) {
      if (boothsOverlap(booths[i]!, booths[j]!, clearanceFt)) return true
    }
  }
  return false
}

export function boothViewPoint(b: RotatedBooth, aisleSide: 'front'): Point {
  const c = boothCenter(b)
  const rad = (b.rotation * Math.PI) / 180
  const offset = b.height / 2 + 2
  const sign = aisleSide === 'front' ? -1 : 1
  return {
    x: c.x + sign * Math.sin(rad) * offset,
    y: c.y + sign * Math.cos(rad) * offset,
  }
}
