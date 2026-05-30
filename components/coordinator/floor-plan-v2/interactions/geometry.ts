import {
  isMergeOverlapExempt,
  type MergeOverlapContext,
} from '@/lib/floor-plan/merge-overlap-policy'
import {
  pointInsidePlacementSurface,
  resolveRoomPlacementSurface,
} from '../state/placement-surface'
import type { FloorPlanDoc, PlacedObject } from '../state/types'

export type { MergeOverlapContext }
import {
  objectFootprintAabb,
  placementProbesForObject,
} from '../state/table-cluster-layout'

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

/** Clearance (px) between exterior wall strokes and architectural labels. */
export const EXTERIOR_LABEL_OFFSET_PX = 12

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

/**
 * Scale room drag/resize deltas so zoomed-out canvases do not turn a
 * small pointer move into a large foot jump (1:1 ft mapping feels
 * hypersensitive below ~100% zoom).
 */
export function roomDragMotionScale(
  zoom: number,
  commandCenter = false
): number {
  const floor = commandCenter ? 0.72 : 0.55
  const zoomFactor = Math.max(floor, Math.min(1, zoom))
  return commandCenter ? zoomFactor * 0.98 : zoomFactor * 0.95
}

/** Coarser grid while positioning whole rooms on the command-center canvas. */
export function roomDragSnapFt(baseSnapFt: number, commandCenter = false): number {
  if (baseSnapFt <= 0) return commandCenter ? 1 : 0
  return commandCenter ? Math.max(baseSnapFt, 1) : baseSnapFt
}

export function scalePointFromAnchor(
  anchor: Point,
  target: Point,
  scale: number
): Point {
  return {
    x: anchor.x + (target.x - anchor.x) * scale,
    y: anchor.y + (target.y - anchor.y) * scale,
  }
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

/**
 * True when two rects share a non-zero intersection area. Edge-touching
 * (zero overlap on either axis) returns false so flush booth placement
 * is allowed while true overlaps still block.
 */
export function rectsOverlapPositiveArea(
  a: Rect,
  b: Rect,
  epsilon = 1e-6
): boolean {
  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return overlapX > epsilon && overlapY > epsilon
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
  const aabb = objectFootprintAabb(obj)
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
 * Axis-aligned bounding box that fully encloses every object in
 * `objects` (each measured by its own rotated AABB). Returns `null`
 * for an empty input so callers can early-out cleanly.
 *
 * Used by group-rotation clamping: instead of nudging each booth
 * independently — which warps the cluster's relative geometry when
 * one corner pokes past the wall — we measure the cluster as one and
 * apply a single uniform translation. This keeps a tilted row of
 * booths flush against the wall after rotation rather than scrambled.
 */
export function groupRotatedAabb(
  objects: ReadonlyArray<PlacedObject>
): Rect | null {
  if (objects.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const obj of objects) {
    const aabb = objectFootprintAabb(obj)
    if (aabb.x < minX) minX = aabb.x
    if (aabb.y < minY) minY = aabb.y
    if (aabb.x + aabb.width > maxX) maxX = aabb.x + aabb.width
    if (aabb.y + aabb.height > maxY) maxY = aabb.y + aabb.height
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Returns true when `rect` sits fully inside the canvas
 * `[0, canvasWidthFt] × [0, canvasLengthFt]`. A small epsilon
 * tolerance absorbs floating-point round-off from the rotation math
 * so a perfectly-flush object never reads as a fraction-of-an-inch
 * overflow.
 *
 * Used as the rotation-preflight gate: callers that have already
 * applied a per-object or group clamp use this to confirm the
 * resulting rotated AABB really is contained, and *halt* the
 * rotation gesture entirely (Strategy A from the spec) if not.
 */
export function aabbFitsCanvas(
  rect: Rect,
  canvasWidthFt: number,
  canvasLengthFt: number
): boolean {
  const eps = 1e-6
  return (
    rect.x >= -eps &&
    rect.y >= -eps &&
    rect.x + rect.width <= canvasWidthFt + eps &&
    rect.y + rect.height <= canvasLengthFt + eps
  )
}

/**
 * Compute the translation `(dx, dy)` to apply uniformly to every
 * object in `objects` so the union of their rotated AABBs sits fully
 * inside `[0, canvasWidthFt] × [0, canvasLengthFt]`.
 *
 * - When the union already fits, returns `{ dx: 0, dy: 0 }`.
 * - When the union pokes past one or more edges but is still narrower
 *   than the canvas on every axis, returns the smallest delta that
 *   pulls it back inside (Strategy B from the spec — "slide the
 *   group's positioning center back inward by that exact offset").
 * - When the union is *wider* or *taller* than the canvas itself,
 *   returns `null`. The cluster cannot be fitted via translation
 *   alone; callers should fall back to per-object clamping or block
 *   the operation entirely (Strategy A).
 */
export function groupCanvasClampDelta(
  objects: ReadonlyArray<PlacedObject>,
  canvasWidthFt: number,
  canvasLengthFt: number
): { dx: number; dy: number } | null {
  const union = groupRotatedAabb(objects)
  if (!union) return { dx: 0, dy: 0 }
  if (union.width > canvasWidthFt || union.height > canvasLengthFt) {
    return null
  }
  let dx = 0
  let dy = 0
  if (union.x < 0) dx = -union.x
  else if (union.x + union.width > canvasWidthFt) {
    dx = canvasWidthFt - (union.x + union.width)
  }
  if (union.y < 0) dy = -union.y
  else if (union.y + union.height > canvasLengthFt) {
    dy = canvasLengthFt - (union.y + union.height)
  }
  return { dx, dy }
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
    const probes = placementProbesForObject(obj)
    for (const probe of probes) {
      if (rectContainsPointRotated(probe, p)) return obj
    }
  }
  return null
}

/** Axis-aligned bounding-box overlap (alias for placement validation). */
export function aabbOverlap(a: Rect, b: Rect): boolean {
  return rectsIntersect(a, b)
}

/**
 * Doors and emergency exits are meant to sit on perimeter walls;
 * their overlap dissolves the wall segment at render time. Skip
 * those pairs so placement validation doesn't fight wall carving.
 */
export function shouldSkipOverlapPair(
  a: PlacedObject,
  b: PlacedObject
): boolean {
  const kinds = new Set([a.kind, b.kind])
  if (!kinds.has('wall')) return false
  return kinds.has('door') || kinds.has('emergency_exit')
}

/**
 * True when the rotated AABBs of `a` and `b` intersect with non-zero
 * area. Edge-touching (zero overlap) returns false.
 */
export function placedObjectsOverlap(
  a: PlacedObject,
  b: PlacedObject,
  ctx?: MergeOverlapContext
): boolean {
  if (shouldSkipOverlapPair(a, b)) return false
  if (ctx && isMergeOverlapExempt(a, b, ctx)) return false
  const probesA = placementProbesForObject(a)
  const probesB = placementProbesForObject(b)
  for (const pa of probesA) {
    for (const pb of probesB) {
      if (rectsOverlapPositiveArea(rotatedAabb(pa), rotatedAabb(pb))) {
        return true
      }
    }
  }
  return false
}

/**
 * Return every object id that participates in at least one overlap
 * with another placed object. Used for static red warning chrome.
 */
export function detectPlacedObjectOverlaps(
  objects: ReadonlyArray<PlacedObject>,
  ctx?: MergeOverlapContext
): Set<string> {
  const overlapping = new Set<string>()
  for (let i = 0; i < objects.length; i++) {
    const a = objects[i]!
    for (let j = i + 1; j < objects.length; j++) {
      const b = objects[j]!
      if (placedObjectsOverlap(a, b, ctx)) {
        overlapping.add(a.id)
        overlapping.add(b.id)
      }
    }
  }
  return overlapping
}

/** True when `probe` overlaps any object in `others`. */
export function placedObjectOverlapsAny(
  probe: PlacedObject,
  others: ReadonlyArray<PlacedObject>,
  excludeIds?: ReadonlySet<string>,
  ctx?: MergeOverlapContext
): boolean {
  for (const other of others) {
    if (excludeIds?.has(other.id)) continue
    if (probe.id === other.id) continue
    if (placedObjectsOverlap(probe, other, ctx)) return true
  }
  return false
}

/**
 * True when any moved object overlaps another moved object or any
 * object outside the move set. Used to block drag/drop commits.
 */
export function findOverlapInMove(
  moved: ReadonlyArray<PlacedObject>,
  others: ReadonlyArray<PlacedObject>,
  ctx?: MergeOverlapContext
): boolean {
  for (let i = 0; i < moved.length; i++) {
    const m = moved[i]!
    for (const o of others) {
      if (placedObjectsOverlap(m, o, ctx)) return true
    }
    for (let j = i + 1; j < moved.length; j++) {
      if (placedObjectsOverlap(m, moved[j]!, ctx)) return true
    }
  }
  return false
}

/* -------------------------------------------------------------------
 * Alignment helpers — used by the toolbar Align Vertical / Align
 * Horizontal commands. Both commands snap selected objects' true
 * geometric centers to the *median* center of the selection on a
 * single axis, leaving the perpendicular axis untouched.
 * ------------------------------------------------------------------- */

/**
 * Pure median of a numeric list.
 *
 * Even-length lists return the average of the two middle values
 * (standard median). Empty input returns `null` so callers don't have
 * to special-case it. Original input is not mutated — we sort a copy.
 *
 * Why median (not mean): a single far-away outlier shouldn't drag
 * every other object across the canvas. Median picks an axis line
 * that's already approximately where most of the selection lives, so
 * the visible motion stays bounded by the existing spread.
 */
export function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * One alignment patch, ready for `FloorPlanDocStore.updateObjects`.
 * `x` / `y` are absolute new positions in ft (top-left of the
 * unrotated bounding box), not deltas.
 */
export interface AlignPatch {
  id: string
  patch: { x?: number; y?: number }
}

/**
 * Compute alignment patches that snap every selected object's
 * geometric center to the median selection center on `axis`:
 *
 *   - axis === 'x'  → snaps **vertical** centers to a common x
 *                     (objects stack into a single column).
 *   - axis === 'y'  → snaps **horizontal** centers to a common y
 *                     (objects line up along a single row).
 *
 * Locked objects are skipped — their center contributes to the
 * median (so they still influence where the line lands) but they
 * never move. Returned patches:
 *   - omit objects already on the median line (within ε) so we
 *     don't churn history with a no-op commit;
 *   - clamp the proposed new position so the object's rotated AABB
 *     stays inside `[0, canvasWidthFt] × [0, canvasLengthFt]` —
 *     alignment never pushes anything off-canvas.
 *
 * Returns `[]` when there's nothing to align (less than two unlocked
 * selected objects). The host treats `[]` as a silent no-op.
 */
export function alignSelectionPatches(
  objects: ReadonlyArray<PlacedObject>,
  axis: 'x' | 'y',
  canvasWidthFt: number,
  canvasLengthFt: number
): AlignPatch[] {
  if (objects.length < 2) return []

  const centers = objects.map((o) => objectCenter(o))
  const targetMedian = median(centers.map((c) => (axis === 'x' ? c.x : c.y)))
  if (targetMedian === null) return []

  const patches: AlignPatch[] = []
  const eps = 1e-4

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i]!
    if (obj.locked) continue
    const c = centers[i]!
    if (axis === 'x') {
      const delta = targetMedian - c.x
      if (Math.abs(delta) < eps) continue
      const proposed: PlacedObject = { ...obj, x: obj.x + delta }
      const clamp = canvasClampDelta(proposed, canvasWidthFt, canvasLengthFt)
      patches.push({ id: obj.id, patch: { x: proposed.x + clamp.dx } })
    } else {
      const delta = targetMedian - c.y
      if (Math.abs(delta) < eps) continue
      const proposed: PlacedObject = { ...obj, y: obj.y + delta }
      const clamp = canvasClampDelta(proposed, canvasWidthFt, canvasLengthFt)
      patches.push({ id: obj.id, patch: { y: proposed.y + clamp.dy } })
    }
  }

  return patches
}

/* -------------------------------------------------------------------
 * Multi-room geometry — perimeter walls, edge merging, and frame
 * hit-testing for the unified canvas.
 * ------------------------------------------------------------------- */

/**
 * One side of a room frame's perimeter, measured in canvas-global
 * feet. `axis` = `'horizontal'` means the segment runs left→right
 * along the perpendicular `coord` (top or bottom edge); `axis` =
 * `'vertical'` means top→bottom along the perpendicular `coord`
 * (left or right edge).
 */
export interface RoomEdge {
  side: 'top' | 'bottom' | 'left' | 'right'
  axis: 'horizontal' | 'vertical'
  /** Constant-perpendicular coord of the edge in ft (y for h, x for v). */
  coord: number
  /** Inclusive [from, to] interval along the edge's parallel axis. */
  from: number
  to: number
}

export interface RoomFrameGeom {
  id: string
  originX: number
  originY: number
  widthFt: number
  lengthFt: number
  /** When set on both neighbours, shared walls are never painted. */
  joinGroupId?: string
}

/** Returns the four perimeter edges of a frame in canvas-global coords. */
export function frameEdges(frame: RoomFrameGeom): RoomEdge[] {
  const { originX: x, originY: y, widthFt: w, lengthFt: l } = frame
  return [
    { side: 'top', axis: 'horizontal', coord: y, from: x, to: x + w },
    { side: 'bottom', axis: 'horizontal', coord: y + l, from: x, to: x + w },
    { side: 'left', axis: 'vertical', coord: x, from: y, to: y + l },
    { side: 'right', axis: 'vertical', coord: x + w, from: y, to: y + l },
  ]
}

/**
 * Merge a list of [from, to] intervals (along the same axis) into
 * a sorted, non-overlapping list. Used by the wall-merge renderer:
 * we collect every neighbor-overlap interval per edge, fold them
 * into one set, and subtract from the edge's full extent.
 */
export function mergeIntervals(
  intervals: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> {
  if (intervals.length === 0) return []
  const sorted = [...intervals]
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = [sorted[0]!]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur[0] <= last[1] + 1e-6) {
      last[1] = Math.max(last[1], cur[1])
    } else {
      out.push(cur)
    }
  }
  return out
}

/**
 * Subtract a sorted, non-overlapping `holes` list from `whole` and
 * return the surviving sub-intervals (the "visible" wall segments
 * after merging neighbours' shared walls). `holes` is assumed to
 * be already merged via `mergeIntervals`.
 */
export function subtractIntervals(
  whole: readonly [number, number],
  holes: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> {
  const eps = 1e-6
  let cursor = whole[0]
  const end = whole[1]
  const out: Array<[number, number]> = []
  for (const [hStart, hEnd] of holes) {
    const cs = Math.max(hStart, whole[0])
    const ce = Math.min(hEnd, end)
    if (ce <= cs) continue
    if (cs - cursor > eps) out.push([cursor, cs])
    cursor = Math.max(cursor, ce)
    if (cursor >= end - eps) break
  }
  if (end - cursor > eps) out.push([cursor, end])
  return out
}

/**
 * For each room frame, compute the visible perimeter wall segments
 * after merging out any portion that overlaps a neighbouring room's
 * coincident edge (within `epsilon` feet on the perpendicular axis
 * AND with non-zero overlap on the parallel axis).
 *
 * Returns a map `frameId → RoomEdge[]` where each entry is an edge
 * sub-interval that should still be painted as a wall. Edges that
 * overlap a neighbour fully are simply omitted from the list — their
 * absence is what makes two adjacent rooms read as a single combined
 * interior with no wall between them.
 */
export function computeRoomWallSegments(
  frames: ReadonlyArray<RoomFrameGeom>,
  epsilon = 0.5
): Map<string, RoomEdge[]> {
  const out = new Map<string, RoomEdge[]>()
  if (frames.length === 0) return out

  const allEdges = frames.map((f) => ({ frame: f, edges: frameEdges(f) }))

  for (const { frame, edges } of allEdges) {
    const merged: RoomEdge[] = []
    for (const edge of edges) {
      const holes: Array<[number, number]> = []
      for (const other of allEdges) {
        if (other.frame.id === frame.id) continue
        if (
          frame.joinGroupId &&
          frame.joinGroupId === other.frame.joinGroupId
        ) {
          continue
        }
        for (const candidate of other.edges) {
          if (candidate.axis !== edge.axis) continue
          // Two edges merge when they share the same perpendicular
          // coord (within tolerance) AND have non-zero overlap on
          // the parallel axis. Sides must be facing each other —
          // a top edge can only merge with a bottom edge, left with
          // right, etc. — so a perimeter wall and an interior offset
          // wall don't accidentally collapse.
          const facing =
            (edge.side === 'top' && candidate.side === 'bottom') ||
            (edge.side === 'bottom' && candidate.side === 'top') ||
            (edge.side === 'left' && candidate.side === 'right') ||
            (edge.side === 'right' && candidate.side === 'left')
          if (!facing) continue
          if (Math.abs(candidate.coord - edge.coord) > epsilon) continue
          const overlapStart = Math.max(edge.from, candidate.from)
          const overlapEnd = Math.min(edge.to, candidate.to)
          if (overlapEnd - overlapStart > 1e-6) {
            holes.push([overlapStart, overlapEnd])
          }
        }
      }
      const visible = subtractIntervals(
        [edge.from, edge.to],
        mergeIntervals(holes)
      )
      for (const [from, to] of visible) {
        merged.push({ ...edge, from, to })
      }
    }
    out.set(frame.id, merged)
  }
  return out
}

/**
 * Detect every pair of frames that share a merged wall segment.
 * Each entry is a directed pair `(a, b)` reported once with `a.id <
 * b.id`. Used by the canvas to paint a "Joined" badge near each
 * pair so coordinators can see at a glance that the two rooms
 * read as one combined interior.
 */
export function detectMergedRoomPairs(
  frames: ReadonlyArray<RoomFrameGeom>,
  epsilon = 0.5
): Array<{ a: string; b: string; sharedLengthFt: number }> {
  const out: Array<{ a: string; b: string; sharedLengthFt: number }> = []
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i]!
      const b = frames[j]!
      const aEdges = frameEdges(a)
      const bEdges = frameEdges(b)
      let shared = 0
      for (const ea of aEdges) {
        for (const eb of bEdges) {
          if (ea.axis !== eb.axis) continue
          const facing =
            (ea.side === 'top' && eb.side === 'bottom') ||
            (ea.side === 'bottom' && eb.side === 'top') ||
            (ea.side === 'left' && eb.side === 'right') ||
            (ea.side === 'right' && eb.side === 'left')
          if (!facing) continue
          if (Math.abs(ea.coord - eb.coord) > epsilon) continue
          const overlap = Math.min(ea.to, eb.to) - Math.max(ea.from, eb.from)
          if (overlap > 1e-6) shared += overlap
        }
      }
      if (shared > 1e-6) {
        out.push({ a: a.id, b: b.id, sharedLengthFt: shared })
      }
    }
  }
  return out
}

/**
 * Hit-test a point against a frame's perimeter walls. Returns true
 * when the point sits within `tolerance` feet of any of the four
 * perimeter edges *and* outside the room's strict interior — so a
 * click on the wall stroke selects the room frame instead of falling
 * through to whatever child object happens to sit on the wall.
 */
/** True when `p` lies inside the frame interior (not just the stroke). */
export function pointInsideFrame(
  frame: RoomFrameGeom,
  p: Point,
  epsilon = 0.05
): boolean {
  return (
    p.x >= frame.originX + epsilon &&
    p.x <= frame.originX + frame.widthFt - epsilon &&
    p.y >= frame.originY + epsilon &&
    p.y <= frame.originY + frame.lengthFt - epsilon
  )
}

/**
 * Prefer union placement surface when `doc` + `roomId` are provided;
 * falls back to rectangular frame interior.
 */
export function pointInsideRoomPlacement(
  frame: RoomFrameGeom,
  p: Point,
  doc?: Pick<FloorPlanDoc, 'rooms' | 'objects' | 'objectRoom'>,
  roomId?: string
): boolean {
  if (doc && roomId) {
    const surface = resolveRoomPlacementSurface(
      doc as FloorPlanDoc,
      roomId
    )
    if (surface) return pointInsidePlacementSurface(p, surface)
  }
  return pointInsideFrame(frame, p)
}

export function pointHitsFrameStroke(
  frame: RoomFrameGeom,
  p: Point,
  tolerance: number
): boolean {
  const inX = p.x >= frame.originX - tolerance && p.x <= frame.originX + frame.widthFt + tolerance
  const inY = p.y >= frame.originY - tolerance && p.y <= frame.originY + frame.lengthFt + tolerance
  if (!inX || !inY) return false
  const distLeft = Math.abs(p.x - frame.originX)
  const distRight = Math.abs(p.x - (frame.originX + frame.widthFt))
  const distTop = Math.abs(p.y - frame.originY)
  const distBottom = Math.abs(p.y - (frame.originY + frame.lengthFt))
  return (
    distLeft <= tolerance ||
    distRight <= tolerance ||
    distTop <= tolerance ||
    distBottom <= tolerance
  )
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
