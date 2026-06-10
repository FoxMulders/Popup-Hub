/**
 * Traffic-Aware Path Optimization layout engine.
 *
 * Replaces generic shelf-scan packing with a pedestrian-flow-first algorithm:
 *   1. Map entrance / exit flow terminals on room boundaries.
 *   2. Generate a serpentine patron pathway linking entry → exit.
 *   3. Pack booths along pathway margins with line-of-sight exposure.
 *   4. Enforce 3′ clearance buffers and treat the traffic corridor as a no-fly zone.
 *   5. Validate final footprints inside merged_zone / room polygons (Turf.js).
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
import {
  VENDOR_BOOTH_AISLE_FT,
} from '@/lib/booth-planner/layout-clearance-constants'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'
import {
  resolveRoomPlacementSurface,
  type PlacementRing,
} from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { evaluateTrafficFlowPrerequisites } from './traffic-flow-prerequisites'
import {
  buildPatronPathway,
  calculatePatronCentricLayout,
  PATRON_CORRIDOR_WIDTH_FT,
  type PatronLayoutPoint,
} from './patron-centric-layout'

/** Minimum edge-to-edge clearance between booth footprints (ft). */
export const AISLE_WIDTH_FT = VENDOR_BOOTH_AISLE_FT

/** Width of the patron traffic corridor treated as a booth no-fly zone (ft). */
export const TRAFFIC_PATH_WIDTH_FT = PATRON_CORRIDOR_WIDTH_FT

/** Uniform safety buffer around every booth edge (ft). */
export const BOOTH_CLEARANCE_BUFFER_FT = VENDOR_BOOTH_AISLE_FT

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

export interface FlowTerminal {
  role: 'entrance' | 'exit'
  x: number
  y: number
}

export interface TrafficAwareLayoutMeta {
  pathway: PatronLayoutPoint[]
  flowTerminals: { entrance: PatronLayoutPoint; exit: PatronLayoutPoint }
  noFlyZoneCount: number
  exposureShifts: number
}

export interface PackBoothsOptions {
  /** Edge-to-edge aisle between booths (default {@link AISLE_WIDTH_FT}). */
  aisleWidth?: number
  /** Restricted zones — stages, pillars, walls, traffic no-fly, etc. */
  obstacles?: ReadonlyArray<BoothPackObstacle>
  /** Scan / snap increment (ft). */
  stepFt?: number
  /** Inset from room bounding box (ft). */
  wallInsetFt?: number
  /** Override entrance (room-local ft). */
  entrance?: PatronLayoutPoint
  /** Override exit (room-local ft). */
  exit?: PatronLayoutPoint
  roomWidthFt?: number
  roomHeightFt?: number
  eventCategoryNames?: ReadonlyArray<string>
}

export interface PackBoothsResult {
  placed: BoothPlacement[]
  unplaced: string[]
  meta?: TrafficAwareLayoutMeta
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
  return samples.every((p) => booleanPointInPolygon(point([p.x, p.y]), room))
}

function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Axis-aligned rects covering the traffic corridor — permanent booth no-fly zone. */
export function buildTrafficNoFlyRects(
  pathway: ReadonlyArray<PatronLayoutPoint>,
  corridorWidthFt: number
): Rect[] {
  const half = corridorWidthFt / 2
  const rects: Rect[] = []
  for (let i = 0; i < pathway.length - 1; i++) {
    const a = pathway[i]!
    const b = pathway[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) >= Math.abs(dy)) {
      rects.push({
        x: Math.min(a.x, b.x) - half,
        y: Math.min(a.y, b.y) - half,
        width: Math.abs(dx) + half * 2,
        height: half * 2,
      })
    } else {
      rects.push({
        x: Math.min(a.x, b.x) - half,
        y: Math.min(a.y, b.y) - half,
        width: half * 2,
        height: Math.abs(dy) + half * 2,
      })
    }
  }
  return rects
}

function resolveFlowTerminals(
  roomW: number,
  roomH: number,
  options: PackBoothsOptions
): { entrance: PatronLayoutPoint; exit: PatronLayoutPoint } {
  if (options.entrance && options.exit) {
    return { entrance: options.entrance, exit: options.exit }
  }
  return {
    entrance: options.entrance ?? {
      x: roomW / 2,
      y: roomH - BOOTH_CLEARANCE_BUFFER_FT - 1,
    },
    exit: options.exit ?? {
      x: roomW / 2,
      y: BOOTH_CLEARANCE_BUFFER_FT + 1,
    },
  }
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
  if (lenSq < 1e-9) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function distToPathway(
  px: number,
  py: number,
  pathway: ReadonlyArray<PatronLayoutPoint>
): number {
  let best = Infinity
  for (let i = 0; i < pathway.length - 1; i++) {
    const a = pathway[i]!
    const b = pathway[i + 1]!
    best = Math.min(best, distPointToSegment(px, py, a.x, a.y, b.x, b.y))
  }
  return best
}

function facadeExposedToPath(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  pathway: ReadonlyArray<PatronLayoutPoint>,
  maxDistFt: number
): boolean {
  const cx = x + width / 2
  const cy = y + height / 2
  const dist = distToPathway(cx, cy, pathway)
  if (dist > maxDistFt) return false
  const rad = (rotation * Math.PI) / 180
  const facadeX = cx + Math.sin(rad) * (height * 0.5)
  const facadeY = cy - Math.cos(rad) * (height * 0.5)
  return distToPathway(facadeX, facadeY, pathway) <= maxDistFt + 1.5
}

function shiftForPathExposure(
  placement: BoothPlacement,
  booth: BoothPackInput,
  pathway: ReadonlyArray<PatronLayoutPoint>,
  roomW: number,
  roomH: number,
  clearanceFt: number,
  noFlyRects: Rect[],
  placedRects: Rect[],
  maxDistFt: number,
  stepFt: number
): { placement: BoothPlacement; shifted: boolean } {
  if (
    facadeExposedToPath(
      placement.x,
      placement.y,
      booth.width,
      booth.height,
      placement.rotation,
      pathway,
      maxDistFt
    )
  ) {
    return { placement, shifted: false }
  }

  const offsets = [
    { dx: stepFt, dy: 0 },
    { dx: -stepFt, dy: 0 },
    { dx: 0, dy: stepFt },
    { dx: 0, dy: -stepFt },
    { dx: stepFt, dy: stepFt },
    { dx: -stepFt, dy: stepFt },
    { dx: stepFt, dy: -stepFt },
    { dx: -stepFt, dy: -stepFt },
  ]

  let best: BoothPlacement | null = null
  let bestDist = Infinity

  for (let pass = 1; pass <= 6; pass++) {
    for (const { dx, dy } of offsets) {
      const candidate: BoothPlacement = {
        ...placement,
        x: placement.x + dx * pass,
        y: placement.y + dy * pass,
      }
      const aabb = rotatedAabb({
        ...candidate,
        kind: 'booth',
        width: booth.width,
        height: booth.height,
      })
      if (
        aabb.x < clearanceFt ||
        aabb.y < clearanceFt ||
        aabb.x + aabb.width > roomW - clearanceFt ||
        aabb.y + aabb.height > roomH - clearanceFt
      ) {
        continue
      }
      const padded = expandRect(aabb, clearanceFt)
      if (noFlyRects.some((r) => aabbOverlap(padded, r))) continue
      if (placedRects.some((r) => aabbOverlap(padded, r))) continue
      if (
        !facadeExposedToPath(
          candidate.x,
          candidate.y,
          booth.width,
          booth.height,
          candidate.rotation,
          pathway,
          maxDistFt
        )
      ) {
        continue
      }
      const cx = candidate.x + booth.width / 2
      const cy = candidate.y + booth.height / 2
      const d = distToPathway(cx, cy, pathway)
      if (d < bestDist) {
        bestDist = d
        best = candidate
      }
    }
    if (best) break
  }

  return best ? { placement: best, shifted: true } : { placement, shifted: false }
}

function obstaclesToRects(
  obstacles: ReadonlyArray<BoothPackObstacle> | undefined
): Rect[] {
  return (obstacles ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }))
}

/**
 * Traffic-aware booth packing inside a rectangular room-local footprint.
 */
export function packBoothsTrafficAware(
  roomWidthFt: number,
  roomHeightFt: number,
  boothList: ReadonlyArray<BoothPackInput>,
  options: PackBoothsOptions = {}
): PackBoothsResult {
  const clearanceFt = options.aisleWidth ?? BOOTH_CLEARANCE_BUFFER_FT
  const stepFt = options.stepFt ?? 0.5
  const corridorWidthFt = TRAFFIC_PATH_WIDTH_FT

  if (boothList.length === 0) {
    return { placed: [], unplaced: [] }
  }

  const { entrance, exit } = resolveFlowTerminals(
    roomWidthFt,
    roomHeightFt,
    options
  )

  const maxDepth = Math.max(...boothList.map((b) => b.height), 6)
  const pathway = buildPatronPathway(
    roomWidthFt,
    roomHeightFt,
    entrance,
    exit,
    corridorWidthFt,
    maxDepth
  )

  const noFlyRects = buildTrafficNoFlyRects(pathway, corridorWidthFt)
  const structuralRects = obstaclesToRects(options.obstacles)
  const layoutObstacles = [...structuralRects, ...noFlyRects]

  const layout = calculatePatronCentricLayout(
    roomWidthFt,
    roomHeightFt,
    boothList.map((b) => ({
      id: b.id,
      width: b.width,
      height: b.height,
      kind: 'booth' as const,
    })),
    {
      entrance,
      exit,
      obstacles: layoutObstacles,
      corridorWidthFt,
      edgeClearanceFt: clearanceFt,
      gridSpacingFt: stepFt,
      eventCategoryNames: options.eventCategoryNames,
      layoutStyle: 'chevron-45',
    }
  )

  const boothById = new Map(boothList.map((b) => [b.id, b]))
  const placed: BoothPlacement[] = []
  const placedRects: Rect[] = []
  let exposureShifts = 0
  const maxExposureDist =
    corridorWidthFt / 2 + Math.max(...boothList.map((b) => b.height), 6) + clearanceFt

  for (const item of layout.placed) {
    const booth = boothById.get(item.id)
    if (!booth) continue

    let candidate: BoothPlacement = {
      id: item.id,
      x: item.x,
      y: item.y,
      rotation: item.rotation,
    }

    const { placement: shifted, shifted: didShift } = shiftForPathExposure(
      candidate,
      booth,
      pathway,
      roomWidthFt,
      roomHeightFt,
      clearanceFt,
      noFlyRects,
      placedRects,
      maxExposureDist,
      stepFt
    )
    candidate = shifted
    if (didShift) exposureShifts++

    const aabb = rotatedAabb({
      ...candidate,
      kind: 'booth',
      width: booth.width,
      height: booth.height,
    })
    placed.push(candidate)
    placedRects.push(expandRect(aabb, clearanceFt))
  }

  const placedIds = new Set(placed.map((p) => p.id))
  const unplaced = [
    ...layout.dropped.map((d) => d.id),
    ...boothList.filter((b) => !placedIds.has(b.id)).map((b) => b.id),
  ]

  return {
    placed,
    unplaced: [...new Set(unplaced)],
    meta: {
      pathway,
      flowTerminals: { entrance, exit },
      noFlyZoneCount: noFlyRects.length,
      exposureShifts,
    },
  }
}

/**
 * Pack booths inside `roomPolygon` (GeoJSON rings) using traffic-aware layout.
 * Booths that cannot fit are listed in `unplaced`.
 */
export function packBooths(
  roomPolygon: Position[][],
  boothList: ReadonlyArray<BoothPackInput>,
  options: PackBoothsOptions = {}
): PackBoothsResult {
  if (roomPolygon.length === 0 || boothList.length === 0) {
    return { placed: [], unplaced: boothList.map((b) => b.id) }
  }

  const room = polygon(roomPolygon)
  const [minX, minY, maxX, maxY] = bbox(room)
  const roomW = options.roomWidthFt ?? maxX - minX
  const roomH = options.roomHeightFt ?? maxY - minY

  const localObstacles = (options.obstacles ?? []).map((o) => ({
    ...o,
    x: o.x - minX,
    y: o.y - minY,
  }))

  const localEntrance = options.entrance
    ? { x: options.entrance.x - minX, y: options.entrance.y - minY }
    : undefined
  const localExit = options.exit
    ? { x: options.exit.x - minX, y: options.exit.y - minY }
    : undefined

  const traffic = packBoothsTrafficAware(roomW, roomH, boothList, {
    ...options,
    obstacles: localObstacles,
    entrance: localEntrance,
    exit: localExit,
    roomWidthFt: roomW,
    roomHeightFt: roomH,
  })

  const placed: BoothPlacement[] = []
  const unplaced = [...traffic.unplaced]

  for (const p of traffic.placed) {
    const booth = boothList.find((b) => b.id === p.id)
    if (!booth) continue
    const global = {
      id: p.id,
      x: p.x + minX,
      y: p.y + minY,
      rotation: p.rotation,
    }
    if (
      boothInsideRoom(
        global.x,
        global.y,
        booth.width,
        booth.height,
        global.rotation,
        room
      )
    ) {
      placed.push(global)
    } else {
      unplaced.push(p.id)
    }
  }

  return {
    placed,
    unplaced: [...new Set(unplaced)],
    meta: traffic.meta,
  }
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
  const roomW = Math.max(1, surface.maxX - surface.minX)
  const roomH = Math.max(1, surface.maxY - surface.minY)

  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const entranceLocal = traffic.entryDoors[0]
    ? { x: traffic.entryDoors[0].centerX, y: traffic.entryDoors[0].centerY }
    : undefined
  const exitLocal = traffic.exitDoors[0]
    ? { x: traffic.exitDoors[0].centerX, y: traffic.exitDoors[0].centerY }
    : undefined

  const localObstacles = obstacles.map((o) => ({
    ...o,
    x: o.x - surface.minX,
    y: o.y - surface.minY,
  }))

  const trafficResult = packBoothsTrafficAware(roomW, roomH, booths, {
    ...options,
    obstacles: localObstacles,
    entrance: entranceLocal,
    exit: exitLocal,
    roomWidthFt: roomW,
    roomHeightFt: roomH,
    stepFt: options.stepFt ?? doc.snapFt ?? 0.5,
    aisleWidth: options.aisleWidth ?? BOOTH_CLEARANCE_BUFFER_FT,
  })

  const placed: BoothPlacement[] = []
  const unplaced = [...trafficResult.unplaced]

  for (const p of trafficResult.placed) {
    const booth = booths.find((b) => b.id === p.id)
    if (!booth) continue
    const global = {
      id: p.id,
      x: p.x + surface.minX,
      y: p.y + surface.minY,
      rotation: p.rotation,
    }
    const footprint = boothFootprintPolygon(
      global.x,
      global.y,
      booth.width,
      booth.height,
      global.rotation
    )
    const room = polygon(roomPolygon)
    if (booleanWithin(footprint, room)) {
      placed.push(global)
    } else {
      unplaced.push(p.id)
    }
  }

  return {
    placed,
    unplaced: [...new Set(unplaced)],
    meta: trafficResult.meta,
  }
}

/** Apply traffic-aware placements onto booth objects; unplaced → off-canvas sentinel. */
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
