import type { PlacedObject } from '../state/types'

/**
 * Geometry helpers — pure math, no React, no DOM.
 *
 * Coordinate spaces:
 * - "client space" : raw browser pointer coords (clientX, clientY).
 * - "viewport space": pixels relative to the canvas viewport's top-left.
 * - "ft space"      : feet relative to the canvas origin (0,0 = top-left
 *                     of the venue rectangle). This is the document's
 *                     native coordinate system.
 */

export interface ViewportTransform {
  /** Pixels per foot at zoom = 1.0 */
  basePxPerFt: number
  /** Current zoom factor. */
  zoom: number
}

export function pxPerFt(t: ViewportTransform): number {
  return t.basePxPerFt * t.zoom
}

export function ftToPx(ft: number, t: ViewportTransform): number {
  return ft * pxPerFt(t)
}

export function pxToFt(px: number, t: ViewportTransform): number {
  const ratio = pxPerFt(t)
  if (ratio === 0) return 0
  return px / ratio
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function snapToGrid(value: number, snapFt: number): number {
  if (snapFt <= 0) return value
  return Math.round(value / snapFt) * snapFt
}

export function snapPoint(p: Point, snapFt: number): Point {
  return { x: snapToGrid(p.x, snapFt), y: snapToGrid(p.y, snapFt) }
}

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(b.x - a.x)
  const height = Math.abs(b.y - a.y)
  return { x, y, width, height }
}

export function rectContainsPoint(rect: Rect, p: Point): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  )
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function objectRect(obj: PlacedObject): Rect {
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
}

/** Geometric center of an axis-aligned object rectangle (in ft space). */
export function objectCenter(obj: PlacedObject): Point {
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 }
}

/**
 * Rotate `p` around `center` by `deg` degrees clockwise (matching the
 * `rotation` field in the document model, which is also clockwise).
 */
export function rotatePointAround(p: Point, center: Point, deg: number): Point {
  if (!deg || !Number.isFinite(deg)) return p
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

/**
 * Axis-aligned bounding box that fully encloses `obj` after rotation
 * around its center. Used by hit-testing, marquee selection, and
 * boundary clamping so a tilted booth still has a faithful screen
 * footprint.
 */
export function rotatedAabb(obj: PlacedObject): Rect {
  const baseRect = objectRect(obj)
  if (!obj.rotation) return baseRect
  const center = objectCenter(obj)
  const corners: Point[] = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ]
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const c of corners) {
    const r = rotatePointAround(c, center, obj.rotation)
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    if (r.x > maxX) maxX = r.x
    if (r.y > maxY) maxY = r.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Point-in-object hit test that respects rotation: rotates the probe
 * point into the object's local (pre-rotation) frame and tests against
 * the axis-aligned rect. This keeps clicks accurate after a booth has
 * been spun via the on-canvas rotate handle.
 */
export function rectContainsPointRotated(obj: PlacedObject, p: Point): boolean {
  if (!obj.rotation) return rectContainsPoint(objectRect(obj), p)
  const local = rotatePointAround(p, objectCenter(obj), -obj.rotation)
  return rectContainsPoint(objectRect(obj), local)
}

/**
 * Compute a translation `(dx, dy)` that, when applied to `obj`, pulls
 * its rotated bounding box fully inside `[0, canvasWidthFt] ×
 * [0, canvasLengthFt]`. If the object is already on-canvas, returns
 * `{ dx: 0, dy: 0 }`. If the object is wider than the canvas it gets
 * pinned to the left/top edge (no clamp on the right/bottom can fit).
 */
export function canvasClampDelta(
  obj: PlacedObject,
  canvasWidthFt: number,
  canvasLengthFt: number
): { dx: number; dy: number } {
  const aabb = rotatedAabb(obj)
  let dx = 0
  let dy = 0
  if (aabb.width <= canvasWidthFt) {
    if (aabb.x < 0) dx = -aabb.x
    else if (aabb.x + aabb.width > canvasWidthFt) {
      dx = canvasWidthFt - (aabb.x + aabb.width)
    }
  } else {
    dx = -aabb.x
  }
  if (aabb.height <= canvasLengthFt) {
    if (aabb.y < 0) dy = -aabb.y
    else if (aabb.y + aabb.height > canvasLengthFt) {
      dy = canvasLengthFt - (aabb.y + aabb.height)
    }
  } else {
    dy = -aabb.y
  }
  return { dx, dy }
}

/** Convenience: returns the (x, y) `obj` should sit at to stay on-canvas. */
export function clampObjectToCanvas(
  obj: PlacedObject,
  canvasWidthFt: number,
  canvasLengthFt: number
): Point {
  const { dx, dy } = canvasClampDelta(obj, canvasWidthFt, canvasLengthFt)
  return { x: obj.x + dx, y: obj.y + dy }
}

/**
 * Hit-test a point against the object list. Walks z-order from top to
 * bottom (last in list = topmost) so the nearest visible object wins.
 * Honours per-object rotation via `rectContainsPointRotated`.
 */
export function hitTest(
  objects: ReadonlyArray<PlacedObject>,
  p: Point
): PlacedObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (rectContainsPointRotated(obj, p)) return obj
  }
  return null
}

/** Translate browser-client coords into ft-space using a known viewport rect. */
export function clientToFt(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect | { left: number; top: number },
  scrollLeft: number,
  scrollTop: number,
  t: ViewportTransform
): Point {
  const localPx = {
    x: clientX - viewportRect.left + scrollLeft,
    y: clientY - viewportRect.top + scrollTop,
  }
  return { x: pxToFt(localPx.x, t), y: pxToFt(localPx.y, t) }
}
