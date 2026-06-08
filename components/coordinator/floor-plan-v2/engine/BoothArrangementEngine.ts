/**
 * Booth bin-packing for merged-zone / room placement surfaces.
 *
 * Uses a greedy MaxRects-style guillotine packer with a 5′ aisle
 * constraint between booth footprints and orients each booth toward
 * the nearest perimeter wall when possible.
 */

import { rotatedAabb, type Point, type Rect } from '../interactions/geometry'
import {
  rotationForPerimeterEdge,
  type RoomEdgeSide,
} from '../interactions/perimeter-booth-orientation'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import { pointInAnyRing } from '../geometry/point-in-polygon'
import {
  pointInsidePlacementSurface,
  resolveRoomPlacementSurface,
  type PlacementRing,
  type PlacementSurface,
} from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

/** Minimum edge-to-edge aisle between booth footprints (ft). */
export const PACK_BOOTH_AISLE_FT = 5

export interface PackBoothsOptions {
  aisleFt?: number
  wallInsetFt?: number
  snapFt?: number
}

export interface PackBoothsResult {
  booths: BoothObject[]
  placedCount: number
  droppedCount: number
}

interface FreeRect {
  x: number
  y: number
  width: number
  height: number
}

function snap(value: number, snapFt: number): number {
  if (snapFt <= 0) return value
  return Math.round(value / snapFt) * snapFt
}

function openRingPoints(
  ring: ReadonlyArray<readonly [number, number]>
): Array<{ x: number; y: number }> {
  if (ring.length === 0) return []
  const pts = ring.map(([x, y]) => ({ x, y }))
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (first.x === last.x && first.y === last.y) pts.pop()
  return pts
}

function ringCentroid(pts: ReadonlyArray<{ x: number; y: number }>): Point {
  if (pts.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / pts.length, y: sy / pts.length }
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

function edgeForSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  centroid: Point,
  epsilon = 1e-6
): RoomEdgeSide | null {
  if (Math.abs(a.y - b.y) <= epsilon) {
    const y = (a.y + b.y) / 2
    return y <= centroid.y ? 'top' : 'bottom'
  }
  if (Math.abs(a.x - b.x) <= epsilon) {
    const x = (a.x + b.x) / 2
    return x <= centroid.x ? 'left' : 'right'
  }
  return null
}

function nearestWallEdge(
  p: Point,
  rings: ReadonlyArray<PlacementRing>
): RoomEdgeSide | null {
  let bestDist = Infinity
  let bestEdge: RoomEdgeSide | null = null

  for (const ring of rings) {
    const pts = openRingPoints(ring)
    if (pts.length < 2) continue
    const centroid = ringCentroid(pts)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      const edge = edgeForSegment(a, b, centroid)
      if (!edge) continue
      const d = distPointToSegment(p.x, p.y, a.x, a.y, b.x, b.y)
      if (d < bestDist) {
        bestDist = d
        bestEdge = edge
      }
    }
  }
  return bestEdge
}

function boothCorners(obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Point[] {
  const center = {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  }
  const raw: Point[] = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ]
  if (!obj.rotation) return raw
  const rad = (obj.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return raw.map((c) => {
    const dx = c.x - center.x
    const dy = c.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  })
}

function boothInsideSurface(
  booth: Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  surface: PlacementSurface
): boolean {
  const center = {
    x: booth.x + booth.width / 2,
    y: booth.y + booth.height / 2,
  }
  if (!pointInsidePlacementSurface(center, surface)) return false
  return boothCorners(booth).every((c) => pointInsidePlacementSurface(c, surface))
}

function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  )
}

function splitFreeRect(free: FreeRect, usedW: number, usedH: number): FreeRect[] {
  const rightW = free.width - usedW
  const bottomH = free.height - usedH
  const next: FreeRect[] = []
  if (rightW > 0.5) {
    next.push({
      x: free.x + usedW,
      y: free.y,
      width: rightW,
      height: usedH,
    })
  }
  if (bottomH > 0.5) {
    next.push({
      x: free.x,
      y: free.y + usedH,
      width: free.width,
      height: bottomH,
    })
  }
  return next
}

function scoreFreeRect(free: FreeRect, w: number, h: number): number {
  const waste = free.width * free.height - w * h
  const shortSide = Math.min(free.width - w, free.height - h)
  return waste * 1000 + shortSide
}

function orientBoothToNearestWall(
  booth: BoothObject,
  surface: PlacementSurface
): BoothObject {
  const center = {
    x: booth.x + booth.width / 2,
    y: booth.y + booth.height / 2,
  }
  const edge = nearestWallEdge(center, surface.outerRings)
  if (!edge) return booth
  const rotation = rotationForPerimeterEdge(edge)
  const oriented = { ...booth, rotation }
  if (boothInsideSurface(oriented, surface)) {
    return oriented
  }
  return booth
}

function packInBounds(
  booths: BoothObject[],
  bounds: Rect,
  aisleFt: number,
  snapFt: number,
  surface: PlacementSurface
): { placed: BoothObject[]; dropped: BoothObject[] } {
  const sorted = [...booths].sort(
    (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)
  )

  let freeRects: FreeRect[] = [{ ...bounds }]
  const placed: BoothObject[] = []
  const dropped: BoothObject[] = []

  for (const booth of sorted) {
    const w = booth.width
    const h = booth.height
    const needW = w + aisleFt
    const needH = h + aisleFt

    let bestIdx = -1
    let bestScore = Infinity
    let bestX = 0
    let bestY = 0

    for (let i = 0; i < freeRects.length; i++) {
      const free = freeRects[i]!
      if (free.width < needW || free.height < needH) continue
      const score = scoreFreeRect(free, needW, needH)
      if (score < bestScore) {
        bestScore = score
        bestIdx = i
        bestX = snap(free.x, snapFt)
        bestY = snap(free.y, snapFt)
      }
    }

    if (bestIdx < 0) {
      dropped.push(booth)
      continue
    }

    const candidate: BoothObject = {
      ...booth,
      x: bestX,
      y: bestY,
      rotation: 0,
    }

    const oriented = orientBoothToNearestWall(candidate, surface)
    const overlaps = placed.some((p) =>
      rectsOverlap(rotatedAabb(oriented), rotatedAabb(p), 0)
    )

    if (!boothInsideSurface(oriented, surface) || overlaps) {
      dropped.push(booth)
      continue
    }

    placed.push(oriented)

    const used = freeRects[bestIdx]!
    const split = splitFreeRect(used, needW, needH)
    freeRects = [...freeRects.slice(0, bestIdx), ...freeRects.slice(bestIdx + 1), ...split]
  }

  return { placed, dropped }
}

/**
 * Pack vendor booths inside the active room's placement surface
 * (merged_zone union or rectangular frame) using greedy MaxRects
 * guillotine packing with {@link PACK_BOOTH_AISLE_FT} aisles.
 */
export function PackBooths(
  doc: FloorPlanDoc,
  roomId: string,
  booths: BoothObject[],
  options: PackBoothsOptions = {}
): PackBoothsResult {
  const aisleFt = options.aisleFt ?? PACK_BOOTH_AISLE_FT
  const wallInsetFt = options.wallInsetFt ?? PERIMETER_WALL_THICKNESS_FT + 0.5
  const snapFt = options.snapFt ?? doc.snapFt ?? 1

  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface || booths.length === 0) {
    return { booths, placedCount: 0, droppedCount: booths.length }
  }

  const bounds: Rect = {
    x: surface.minX + wallInsetFt,
    y: surface.minY + wallInsetFt,
    width: Math.max(1, surface.maxX - surface.minX - wallInsetFt * 2),
    height: Math.max(1, surface.maxY - surface.minY - wallInsetFt * 2),
  }

  const { placed, dropped } = packInBounds(
    booths,
    bounds,
    aisleFt,
    snapFt,
    surface
  )

  return {
    booths: placed,
    placedCount: placed.length,
    droppedCount: dropped.length,
  }
}

/** Vendor booths tagged to a room — excludes guest/patron tables. */
export function vendorBoothsInRoom(
  doc: FloorPlanDoc,
  roomId: string
): BoothObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter(
    (o): o is BoothObject =>
      o.kind === 'booth' &&
      objectRoom[o.id] === roomId &&
      !isGuestTableBooth(o)
  )
}

/**
 * Clear booth coordinates (off-canvas sentinel) then pack inside
 * merged_zone / room surfaces. Returns updated `doc.objects`.
 */
export function applyPackedBoothsToDoc(
  doc: FloorPlanDoc,
  roomId: string,
  packed: BoothObject[]
): FloorPlanDoc {
  const packedById = new Map(packed.map((b) => [b.id, b]))
  const objectRoom = doc.objectRoom ?? {}
  const objects = doc.objects.map((o) => {
    if (o.kind !== 'booth' || objectRoom[o.id] !== roomId) return o
    if (isGuestTableBooth(o)) return o
    const next = packedById.get(o.id)
    if (!next) {
      return { ...o, x: -999, y: -999, rotation: 0 }
    }
    return { ...o, ...next }
  })
  return { ...doc, objects }
}

/** Collect merged_zone outer rings for the active room (when present). */
export function mergedZoneRingsForRoom(
  doc: FloorPlanDoc,
  roomId: string
): PlacementRing[] {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  return surface ? [...surface.outerRings] : []
}

/** True when every corner of the booth lies inside a merged/placement ring. */
export function boothInsideMergedZone(
  booth: BoothObject,
  rings: ReadonlyArray<PlacementRing>
): boolean {
  return boothCorners(booth).every((c) => pointInAnyRing(c, rings))
}
