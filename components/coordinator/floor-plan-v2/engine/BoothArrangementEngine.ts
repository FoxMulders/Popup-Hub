/**
 * Booth bin-packing for merged-zone / room placement surfaces.
 *
 * Delegates geometry validation to {@link AutoArrangeEngine} (Turf.js
 * shelf scan). Keeps doc-level helpers used by pathfinding and UI.
 */

import { rotatedAabb, type Point, type Rect } from '../interactions/geometry'
import {
  rotationForPerimeterEdge,
  type RoomEdgeSide,
} from '../interactions/perimeter-booth-orientation'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import { pointInAnyRing } from '../geometry/point-in-polygon'
import {
  resolveRoomPlacementSurface,
  type PlacementRing,
  type PlacementSurface,
} from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  AISLE_WIDTH_FT,
  applyPlacementsToBooths,
  packBoothsForRoom,
} from './AutoArrangeEngine'

/** Minimum edge-to-edge aisle between booth footprints (ft). */
export const PACK_BOOTH_AISLE_FT = AISLE_WIDTH_FT

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
  return { ...booth, rotation }
}

/**
 * Pack vendor booths inside the active room's placement surface
 * (merged_zone union or rectangular frame) using Turf-validated shelf
 * packing with {@link PACK_BOOTH_AISLE_FT} aisles.
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

  const packResult = packBoothsForRoom(
    doc,
    roomId,
    booths.map((b) => ({ id: b.id, width: b.width, height: b.height })),
    { aisleWidth: aisleFt, wallInsetFt, stepFt: snapFt }
  )

  const packed = applyPlacementsToBooths(booths, packResult).map((b) => {
    if (b.x < -900) return b
    return orientBoothToNearestWall(b, surface)
  })

  const placedCount = packResult.placed.length
  return {
    booths: packed,
    placedCount,
    droppedCount: packResult.unplaced.length,
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

export { packBooths, packBoothsForRoom } from './AutoArrangeEngine'
export type {
  BoothPackInput,
  BoothPlacement,
  PackBoothsResult as TurfPackBoothsResult,
} from './AutoArrangeEngine'
