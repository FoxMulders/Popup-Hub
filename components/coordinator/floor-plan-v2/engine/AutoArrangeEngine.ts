/**
 * Geometry-first booth packing — shelf scan inside a merged_zone polygon.
 *
 * Every candidate placement is validated with Turf.js:
 *   - `booleanPointInPolygon` — booth center + corners inside the room ring
 *   - `booleanOverlap` — no collision with placed booths or restricted zones
 */

import {
  bbox,
  booleanOverlap,
  booleanPointInPolygon,
  booleanWithin,
  point,
  polygon,
} from '@turf/turf'
import type { Feature, Polygon, Position } from 'geojson'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import { rotatedAabb } from '../interactions/geometry'
import {
  resolveRoomPlacementSurface,
  type PlacementRing,
} from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'

/** Minimum edge-to-edge aisle between booth footprints (ft). */
export const AISLE_WIDTH_FT = 5

export interface BoothPackInput {
  id: string
  width: number
  height: number
}

export interface BoothPackObstacle {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface BoothPlacement {
  id: string
  x: number
  y: number
  rotation: number
}

export interface PackBoothsOptions {
  /** Edge-to-edge aisle between booths (default {@link AISLE_WIDTH_FT}). */
  aisleWidth?: number
  /** Restricted zones — stages, pillars, walls, etc. */
  obstacles?: ReadonlyArray<BoothPackObstacle>
  /** Scan increment inside the room bounding box (ft). */
  stepFt?: number
  /** Inset from the room bounding box before scanning (ft). */
  wallInsetFt?: number
}

export interface PackBoothsResult {
  placed: BoothPlacement[]
  unplaced: string[]
}

function closeRingCoords(ring: ReadonlyArray<readonly [number, number]>): Position[] {
  if (ring.length === 0) return []
  const coords = ring.map(([x, y]) => [x, y] as Position)
  const first = coords[0]!
  const last = coords[coords.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return coords
}

export function ringToRoomPolygon(ring: PlacementRing): Position[][] {
  return [closeRingCoords(ring)]
}

function boothCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number
): Array<{ x: number; y: number }> {
  const center = { x: x + width / 2, y: y + height / 2 }
  const raw = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
  if (!rotationDeg) return raw
  const rad = (rotationDeg * Math.PI) / 180
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

function boothFootprintPolygon(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number
): Feature<Polygon> {
  const corners = boothCorners(x, y, width, height, rotationDeg)
  const ring: Position[] = corners.map((c) => [c.x, c.y])
  const first = ring[0]!
  ring.push([first[0], first[1]])
  return polygon([ring])
}

/** Expand a booth polygon outward by half the aisle on every side. */
function aisleBufferedPolygon(
  footprint: Feature<Polygon>,
  aisleWidth: number
): Feature<Polygon> {
  const half = aisleWidth / 2
  const ring = footprint.geometry.coordinates[0]
  if (!ring || ring.length < 4) return footprint

  let cx = 0
  let cy = 0
  const verts = ring.slice(0, -1)
  for (const [x, y] of verts) {
    cx += x
    cy += y
  }
  cx /= verts.length
  cy /= verts.length

  const expanded: Position[] = verts.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    return [x + (dx / len) * half, y + (dy / len) * half]
  })
  const first = expanded[0]!
  expanded.push([first[0], first[1]])
  return polygon([expanded])
}

function boothInsideRoom(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  room: Feature<Polygon>
): boolean {
  const footprint = boothFootprintPolygon(x, y, width, height, rotationDeg)
  if (!booleanWithin(footprint, room)) return false

  const center = { x: x + width / 2, y: y + height / 2 }
  const samples = [center, ...boothCorners(x, y, width, height, rotationDeg)]
  return samples.every((p) =>
    booleanPointInPolygon(point([p.x, p.y]), room)
  )
}

function overlapsAny(
  candidate: Feature<Polygon>,
  others: ReadonlyArray<Feature<Polygon>>,
  aisleWidth: number
): boolean {
  const buffered = aisleBufferedPolygon(candidate, aisleWidth)
  for (const other of others) {
    const otherBuffered = aisleBufferedPolygon(other, aisleWidth)
    if (booleanOverlap(buffered, otherBuffered)) return true
  }
  return false
}

function isValidPlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  room: Feature<Polygon>,
  placedFootprints: Feature<Polygon>[],
  obstacleFootprints: Feature<Polygon>[],
  aisleWidth: number
): boolean {
  if (!boothInsideRoom(x, y, width, height, rotationDeg, room)) return false
  const footprint = boothFootprintPolygon(x, y, width, height, rotationDeg)
  if (overlapsAny(footprint, placedFootprints, aisleWidth)) return false
  if (overlapsAny(footprint, obstacleFootprints, aisleWidth)) return false
  return true
}

/**
 * Shelf-pack booths inside `roomPolygon` (GeoJSON rings, first = outer boundary).
 * Booths that cannot fit are listed in `unplaced` — never forced onto the canvas.
 */
export function packBooths(
  roomPolygon: Position[][],
  boothList: ReadonlyArray<BoothPackInput>,
  options: PackBoothsOptions = {}
): PackBoothsResult {
  const aisleWidth = options.aisleWidth ?? AISLE_WIDTH_FT
  const stepFt = options.stepFt ?? 1
  const wallInsetFt = options.wallInsetFt ?? PERIMETER_WALL_THICKNESS_FT + 0.5

  if (roomPolygon.length === 0 || boothList.length === 0) {
    return { placed: [], unplaced: boothList.map((b) => b.id) }
  }

  const room = polygon(roomPolygon)
  const [minX, minY, maxX, maxY] = bbox(room)

  const obstacleFootprints = (options.obstacles ?? []).map((o) =>
    boothFootprintPolygon(o.x, o.y, o.width, o.height, o.rotation ?? 0)
  )

  const sorted = [...boothList].sort(
    (a, b) => b.width * b.height - a.width * a.height
  )

  const placed: BoothPlacement[] = []
  const placedFootprints: Feature<Polygon>[] = []
  const unplaced: string[] = []

  const scanMinX = minX + wallInsetFt
  const scanMinY = minY + wallInsetFt
  const scanMaxX = maxX - wallInsetFt
  const scanMaxY = maxY - wallInsetFt

  for (const booth of sorted) {
    let found: BoothPlacement | null = null

    for (const rotation of [0, 90] as const) {
      const w = rotation === 90 ? booth.height : booth.width
      const h = rotation === 90 ? booth.width : booth.height

      outer: for (let y = scanMinY; y + h <= scanMaxY; y += stepFt) {
        for (let x = scanMinX; x + w <= scanMaxX; x += stepFt) {
          if (
            isValidPlacement(
              x,
              y,
              w,
              h,
              rotation,
              room,
              placedFootprints,
              obstacleFootprints,
              aisleWidth
            )
          ) {
            found = { id: booth.id, x, y, rotation }
            placedFootprints.push(boothFootprintPolygon(x, y, w, h, rotation))
            break outer
          }
        }
      }

      if (found) break
    }

    if (found) {
      placed.push(found)
    } else {
      unplaced.push(booth.id)
    }
  }

  return { placed, unplaced }
}

const RESTRICTED_KINDS = new Set<PlacedObject['kind']>([
  'wall',
  'open_wall',
  'door',
  'emergency_exit',
  'stage',
  'label',
  'food_truck',
])

/** Structural obstacles in a room — stages, walls, doors, etc. */
export function restrictedObstaclesInRoom(
  doc: FloorPlanDoc,
  roomId: string
): BoothPackObstacle[] {
  const objectRoom = doc.objectRoom ?? {}
  const out: BoothPackObstacle[] = []
  for (const obj of doc.objects) {
    if (obj.kind === 'booth' || obj.kind === 'merged_zone') continue
    if (objectRoom[obj.id] !== roomId) continue
    if (!RESTRICTED_KINDS.has(obj.kind)) continue
    const aabb = rotatedAabb(obj)
    out.push({
      x: aabb.x,
      y: aabb.y,
      width: aabb.width,
      height: aabb.height,
      rotation: obj.rotation,
    })
  }
  return out
}

/** Resolve merged_zone / room rings and pack vendor booths for a doc room. */
export function packBoothsForRoom(
  doc: FloorPlanDoc,
  roomId: string,
  booths: ReadonlyArray<BoothPackInput>,
  options: Omit<PackBoothsOptions, 'obstacles'> = {}
): PackBoothsResult {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface || surface.outerRings.length === 0) {
    return { placed: [], unplaced: booths.map((b) => b.id) }
  }

  const roomPolygon = ringToRoomPolygon(surface.outerRings[0]!)
  const obstacles = restrictedObstaclesInRoom(doc, roomId)

  return packBooths(roomPolygon, booths, {
    ...options,
    obstacles,
    stepFt: options.stepFt ?? doc.snapFt ?? 1,
  })
}

/** Apply {@link packBooths} placements onto booth objects; unplaced → off-canvas sentinel. */
export function applyPlacementsToBooths(
  booths: BoothObject[],
  result: PackBoothsResult
): BoothObject[] {
  const byId = new Map(result.placed.map((p) => [p.id, p]))
  return booths.map((b) => {
    const placement = byId.get(b.id)
    if (!placement) {
      return { ...b, x: -999, y: -999, rotation: 0 }
    }
    return { ...b, ...placement }
  })
}
