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

/**
 * Hit-test a point against the object list. Walks z-order from top to
 * bottom (last in list = topmost) so the nearest visible object wins.
 */
export function hitTest(
  objects: ReadonlyArray<PlacedObject>,
  p: Point
): PlacedObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (rectContainsPoint(objectRect(obj), p)) return obj
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
