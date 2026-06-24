/**
 * Grid-based A* pathfinding for patron traffic through the hall.
 *
 * Walkable cells lie inside merged_zone / room boundary polygons.
 * Booths, stages, and walls are impassable. The patron tour uses
 * A*-distance nearest-neighbor booth ordering with approach nodes,
 * door threshold terminals, and LOS string-pull smoothing.
 */

import { pointInAnyRing } from '../geometry/point-in-polygon'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import {
  resolveRoomPlacementSurface,
  type PlacementRing,
} from '../state/placement-surface'
import { objectFootprintAabb } from '../state/table-cluster-layout'
import type { BoothObject, DoorObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { MIN_CLEARANCE_FT, PERIMETER_WALL_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'
import { BOOTH_CLEARANCE_GOOD_FT } from '@/lib/coordinator/booth-clearance-visual'
import { IDEAL_PEDESTRIAN_AISLE_FT } from '@/lib/floor-plan/layout-density'
import { stringPullGridPath } from '@/lib/floor-plan/grid-path-smoothing'
import { mergedZoneRingsForRoom, vendorBoothsInRoom } from './BoothArrangementEngine'
import {
  evaluateTrafficFlowPrerequisites,
  type TrafficFlowDoorSnapshot,
} from './traffic-flow-prerequisites'

export interface PathPoint {
  x: number
  y: number
}

export interface OptimalPathResult {
  path: PathPoint[]
  /** Disconnected legs — avoids phantom straight-line chords between failed segments. */
  pathSegments?: PathPoint[][]
  visitOrder: string[]
  totalDistanceFt: number
  isPartial?: boolean
  missingDoors?: boolean
  missedBoothIds?: string[]
  visitedBoothIds?: string[]
  bottleneckBoothIds?: string[]
  clearanceMode?: 'strict' | 'relaxed'
}

export interface NavigationGrid {
  walkable: boolean[][]
  cols: number
  rows: number
  originX: number
  originY: number
  cellFt: number
}

export interface CalculateOptimalPathOptions {
  cellFt?: number
  obstacleBufferFt?: number
  booths?: ReadonlyArray<BoothObject>
  roomBoundary?: ReadonlyArray<PlacementRing>
}

interface GridCoord {
  col: number
  row: number
}

interface RouteWaypoint {
  point: PathPoint
  boothId?: string
}

const CARDINAL = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
] as const

const IMPASSABLE_KINDS = new Set<PlacedObject['kind']>([
  'booth',
  'stage',
  'wall',
  'food_court',
  'amenity',
  'food_truck',
])
const OFF_CANVAS_SENTINEL_X = -500

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function parseKey(key: string): GridCoord {
  const [col, row] = key.split(',').map(Number)
  return { col: col!, row: row! }
}

function euclideanGrid(a: GridCoord, b: GridCoord): number {
  return Math.hypot(a.col - b.col, a.row - b.row)
}

function centerOf(obj: PlacedObject): PathPoint {
  const aabb = rotatedAabb(obj)
  return {
    x: aabb.x + aabb.width / 2,
    y: aabb.y + aabb.height / 2,
  }
}

function objectsInRoom(doc: FloorPlanDoc, roomId: string): PlacedObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter((o) => objectRoom[o.id] === roomId)
}

function resolveWalkableRings(
  doc: FloorPlanDoc,
  roomId: string,
  roomBoundary?: ReadonlyArray<PlacementRing>
): { rings: PlacementRing[]; minX: number; minY: number; maxX: number; maxY: number; centroid: PathPoint } | null {
  if (roomBoundary && roomBoundary.length > 0) {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let sx = 0
    let sy = 0
    let count = 0
    for (const ring of roomBoundary) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        sx += x
        sy += y
        count++
      }
    }
    if (!Number.isFinite(minX)) return null
    return {
      rings: [...roomBoundary],
      minX,
      minY,
      maxX,
      maxY,
      centroid: { x: sx / count, y: sy / count },
    }
  }

  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface) return null
  return {
    rings: [...surface.outerRings],
    minX: surface.minX,
    minY: surface.minY,
    maxX: surface.maxX,
    maxY: surface.maxY,
    centroid: surface.centroid,
  }
}

function isPlacedOnCanvas(obj: PlacedObject): boolean {
  return obj.x > OFF_CANVAS_SENTINEL_X
}

function obstacleFootprintAabb(obj: PlacedObject): Rect {
  if (obj.kind === 'booth') {
    return objectFootprintAabb(obj)
  }
  return rotatedAabb(obj)
}

function collectLayoutObstacles(
  doc: FloorPlanDoc,
  roomId: string,
  layoutBooths: ReadonlyArray<BoothObject>
): PlacedObject[] {
  const seen = new Set<string>()
  const obstacles: PlacedObject[] = []

  const push = (obj: PlacedObject) => {
    if (seen.has(obj.id)) return
    seen.add(obj.id)
    obstacles.push(obj)
  }

  for (const obj of objectsInRoom(doc, roomId)) {
    if (IMPASSABLE_KINDS.has(obj.kind)) {
      push(obj)
    }
  }

  for (const booth of layoutBooths) {
    if (isPlacedOnCanvas(booth)) {
      push(booth)
    }
  }

  return obstacles
}

function markFootprintOnGrid(
  walkable: boolean[][],
  aabb: Rect,
  originX: number,
  originY: number,
  cellFt: number,
  paddingFt: number,
  rows: number,
  cols: number
): void {
  const minCol = Math.floor((aabb.x - paddingFt - originX) / cellFt)
  const maxCol = Math.ceil((aabb.x + aabb.width + paddingFt - originX) / cellFt)
  const minRow = Math.floor((aabb.y - paddingFt - originY) / cellFt)
  const maxRow = Math.ceil((aabb.y + aabb.height + paddingFt - originY) / cellFt)

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        walkable[row]![col] = false
      }
    }
  }
}

function applyCornerClearanceGuard(
  walkable: boolean[][],
  rows: number,
  cols: number
): void {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!walkable[row]![col]) continue

      const northBlocked = row > 0 && !walkable[row - 1]![col]
      const southBlocked = row < rows - 1 && !walkable[row + 1]![col]
      const westBlocked = col > 0 && !walkable[row]![col - 1]
      const eastBlocked = col < cols - 1 && !walkable[row]![col + 1]

      if (
        (northBlocked && westBlocked) ||
        (northBlocked && eastBlocked) ||
        (southBlocked && westBlocked) ||
        (southBlocked && eastBlocked)
      ) {
        walkable[row]![col] = false
      }
    }
  }
}

export function buildNavigationGrid(
  doc: FloorPlanDoc,
  roomId: string,
  options: Pick<
    CalculateOptimalPathOptions,
    'cellFt' | 'obstacleBufferFt' | 'roomBoundary' | 'booths'
  > = {}
): NavigationGrid | null {
  const cellFt = options.cellFt ?? doc.snapFt ?? 1
  const clearanceFt = options.obstacleBufferFt ?? MIN_CLEARANCE_FT
  const boundary = resolveWalkableRings(doc, roomId, options.roomBoundary)
  if (!boundary) return null

  const { rings, minX, minY, maxX, maxY } = boundary
  const originX = minX
  const originY = minY
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellFt))
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellFt))

  const walkable: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  )

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const center = {
        x: originX + (c + 0.5) * cellFt,
        y: originY + (r + 0.5) * cellFt,
      }
      if (pointInAnyRing(center, rings)) {
        walkable[r]![c] = true
      }
    }
  }

  const layoutBooths = options.booths ?? vendorBoothsInRoom(doc, roomId)
  const obstacles = collectLayoutObstacles(doc, roomId, layoutBooths)

  for (const obj of obstacles) {
    markFootprintOnGrid(
      walkable,
      obstacleFootprintAabb(obj),
      originX,
      originY,
      cellFt,
      clearanceFt,
      rows,
      cols
    )
  }

  applyCornerClearanceGuard(walkable, rows, cols)

  return { walkable, cols, rows, originX, originY, cellFt }
}

function snapToWalkable(
  col: number,
  row: number,
  walkable: boolean[][],
  cols: number,
  rows: number
): GridCoord | null {
  if (row >= 0 && row < rows && col >= 0 && col < cols && walkable[row]![col]) {
    return { col, row }
  }
  const maxRadius = Math.max(cols, rows)
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = row + dr
        const nc = col + dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
        if (walkable[nr]![nc]) return { col: nc, row: nr }
      }
    }
  }
  return null
}

function ftToGrid(
  p: PathPoint,
  originX: number,
  originY: number,
  cellFt: number
): GridCoord {
  return {
    col: Math.round((p.x - originX) / cellFt - 0.5),
    row: Math.round((p.y - originY) / cellFt - 0.5),
  }
}

function gridToFt(
  g: GridCoord,
  originX: number,
  originY: number,
  cellFt: number
): PathPoint {
  return {
    x: originX + (g.col + 0.5) * cellFt,
    y: originY + (g.row + 0.5) * cellFt,
  }
}

function roomSurfaceOrigin(
  doc: FloorPlanDoc,
  roomId: string
): { originX: number; originY: number } {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  const surface = resolveRoomPlacementSurface(doc, roomId)
  return {
    originX: surface?.minX ?? frame?.originX ?? 0,
    originY: surface?.minY ?? frame?.originY ?? 0,
  }
}

/** Project door center inward from the perimeter into the walkable hall. */
function thresholdFromDoorSnapshot(
  snap: TrafficFlowDoorSnapshot,
  originX: number,
  originY: number
): PathPoint {
  let lx = snap.centerX
  let ly = snap.centerY
  const inset = PERIMETER_WALL_CLEARANCE_FT
  switch (snap.wallEdge) {
    case 'top':
      ly += inset
      break
    case 'bottom':
      ly -= inset
      break
    case 'left':
      lx += inset
      break
    case 'right':
      lx -= inset
      break
  }
  return { x: originX + lx, y: originY + ly }
}

function resolveDoorThresholdWalkPoint(
  snap: TrafficFlowDoorSnapshot,
  originX: number,
  originY: number,
  grid: NavigationGrid
): PathPoint | null {
  const threshold = thresholdFromDoorSnapshot(snap, originX, originY)
  const g = ftToGrid(threshold, grid.originX, grid.originY, grid.cellFt)
  const snapped = snapToWalkable(g.col, g.row, grid.walkable, grid.cols, grid.rows)
  if (!snapped) return null
  return gridToFt(snapped, grid.originX, grid.originY, grid.cellFt)
}

function isEntryDoor(obj: PlacedObject): obj is DoorObject {
  return obj.kind === 'door' && obj.doorType === 'entrance'
}

function nearestWallEdgeGlobal(
  cx: number,
  cy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): TrafficFlowDoorSnapshot['wallEdge'] {
  const distTop = cy - minY
  const distBottom = maxY - cy
  const distLeft = cx - minX
  const distRight = maxX - cx
  const min = Math.min(distTop, distBottom, distLeft, distRight)
  if (min === distTop) return 'top'
  if (min === distRight) return 'right'
  if (min === distBottom) return 'bottom'
  return 'left'
}

/** Fallback when objectRoom tags are missing — doors overlapping room bounds. */
function findDoorsNearRoom(
  doc: FloorPlanDoc,
  roomId: string
): { entry: PlacedObject | null; exit: PlacedObject | null } {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return { entry: null, exit: null }

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const minX = surface?.minX ?? frame.originX
  const minY = surface?.minY ?? frame.originY
  const maxX = surface?.maxX ?? frame.originX + frame.widthFt
  const maxY = surface?.maxY ?? frame.originY + frame.lengthFt
  const pad = 4

  const inBounds = (obj: PlacedObject) => {
    const aabb = rotatedAabb(obj)
    const cx = aabb.x + aabb.width / 2
    const cy = aabb.y + aabb.height / 2
    return (
      cx >= minX - pad &&
      cx <= maxX + pad &&
      cy >= minY - pad &&
      cy <= maxY + pad
    )
  }

  const candidates = doc.objects.filter(
    (o) =>
      (o.kind === 'door' || o.kind === 'emergency_exit') && inBounds(o)
  )

  const entry =
    candidates.find(isEntryDoor) ??
    candidates.find((o) => o.kind === 'door') ??
    null
  const exit =
    candidates.find((o) => o.kind === 'emergency_exit') ??
    candidates.find(
      (o) => o.kind === 'door' && (o as DoorObject).doorType === 'exit'
    ) ??
    null

  return { entry, exit }
}

function doorSnapshotFromObject(
  obj: PlacedObject,
  role: 'entry' | 'exit',
  originX: number,
  originY: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): TrafficFlowDoorSnapshot {
  const aabb = rotatedAabb(obj)
  const cx = aabb.x + aabb.width / 2
  const cy = aabb.y + aabb.height / 2
  return {
    id: obj.id,
    role,
    kind: obj.kind === 'emergency_exit' ? 'emergency_exit' : 'door',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation ?? 0,
    centerX: cx - originX,
    centerY: cy - originY,
    wallEdge: nearestWallEdgeGlobal(cx, cy, minX, minY, maxX, maxY),
  }
}

function resolveFlowTerminals(
  doc: FloorPlanDoc,
  roomId: string,
  grid: NavigationGrid
): {
  entry: PathPoint | null
  exit: PathPoint | null
  missingDoors: boolean
} {
  const { originX, originY } = roomSurfaceOrigin(doc, roomId)
  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)

  let entrySnap = traffic.entryDoors[0] ?? null
  let exitSnap = traffic.exitDoors[0] ?? null

  if (!entrySnap || !exitSnap) {
    const fallback = findDoorsNearRoom(doc, roomId)
    const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
    const surface = resolveRoomPlacementSurface(doc, roomId)
    const minX = surface?.minX ?? frame?.originX ?? 0
    const minY = surface?.minY ?? frame?.originY ?? 0
    const maxX = surface?.maxX ?? (frame ? frame.originX + frame.widthFt : minX)
    const maxY = surface?.maxY ?? (frame ? frame.originY + frame.lengthFt : minY)

    if (!entrySnap && fallback.entry) {
      entrySnap = doorSnapshotFromObject(
        fallback.entry,
        'entry',
        originX,
        originY,
        minX,
        minY,
        maxX,
        maxY
      )
    }
    if (!exitSnap && fallback.exit) {
      exitSnap = doorSnapshotFromObject(
        fallback.exit,
        'exit',
        originX,
        originY,
        minX,
        minY,
        maxX,
        maxY
      )
    }
  }

  if (!entrySnap) {
    return { entry: null, exit: null, missingDoors: true }
  }

  const entry = resolveDoorThresholdWalkPoint(entrySnap, originX, originY, grid)
  const exit = exitSnap
    ? resolveDoorThresholdWalkPoint(exitSnap, originX, originY, grid)
    : null

  return { entry, exit, missingDoors: !entry }
}

function distPointToRectEdge(p: PathPoint, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height))
  return Math.hypot(dx, dy)
}

function resolveBoothApproachPoint(
  booth: BoothObject,
  grid: NavigationGrid,
  preferFrom: PathPoint,
  localClearanceFt: number[][]
): PathPoint | null {
  const aabb = objectFootprintAabb(booth)
  const pad = MIN_CLEARANCE_FT + 2
  const minCol = Math.floor((aabb.x - pad - grid.originX) / grid.cellFt)
  const maxCol = Math.ceil((aabb.x + aabb.width + pad - grid.originX) / grid.cellFt)
  const minRow = Math.floor((aabb.y - pad - grid.originY) / grid.cellFt)
  const maxRow = Math.ceil((aabb.y + aabb.height + pad - grid.originY) / grid.cellFt)

  const boothCenter = centerOf(booth)
  const fromGrid = ftToGrid(preferFrom, grid.originX, grid.originY, grid.cellFt)
  const maxEdgeDist = MIN_CLEARANCE_FT + grid.cellFt * 1.25
  const candidates: GridCoord[] = []

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue
      if (!grid.walkable[row]![col]) continue
      const pt = gridToFt({ col, row }, grid.originX, grid.originY, grid.cellFt)
      if (distPointToRectEdge(pt, aabb) > maxEdgeDist) continue
      candidates.push({ col, row })
    }
  }

  if (candidates.length === 0) {
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue
        if (grid.walkable[row]![col]) candidates.push({ col, row })
      }
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const pa = gridToFt(a, grid.originX, grid.originY, grid.cellFt)
    const pb = gridToFt(b, grid.originX, grid.originY, grid.cellFt)
    const edgeA = distPointToRectEdge(pa, aabb)
    const edgeB = distPointToRectEdge(pb, aabb)
    if (Math.abs(edgeA - edgeB) > 0.01) return edgeA - edgeB
    const scoreA =
      Math.hypot(pa.x - preferFrom.x, pa.y - preferFrom.y) -
      (localClearanceFt[a.row]?.[a.col] ?? 0) * 0.05
    const scoreB =
      Math.hypot(pb.x - preferFrom.x, pb.y - preferFrom.y) -
      (localClearanceFt[b.row]?.[b.col] ?? 0) * 0.05
    return scoreA - scoreB
  })

  for (const candidate of candidates) {
    const segment = astarGridClearanceBiased(
      grid.walkable,
      fromGrid,
      candidate,
      grid.cols,
      grid.rows,
      localClearanceFt
    )
    if (segment) {
      return gridToFt(candidate, grid.originX, grid.originY, grid.cellFt)
    }
  }

  const best = candidates[0]!
  return gridToFt(best, grid.originX, grid.originY, grid.cellFt)
}

export function astarGrid(
  walkable: boolean[][],
  start: GridCoord,
  goal: GridCoord,
  cols: number,
  rows: number
): GridCoord[] | null {
  const from = snapToWalkable(start.col, start.row, walkable, cols, rows)
  const to = snapToWalkable(goal.col, goal.row, walkable, cols, rows)
  if (!from || !to) return null

  const goalKey = cellKey(to.col, to.row)
  const open: Array<{ key: string; f: number }> = []
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string | null>()

  const startKey = cellKey(from.col, from.row)
  gScore.set(startKey, 0)
  cameFrom.set(startKey, null)
  open.push({ key: startKey, f: euclideanGrid(from, to) })

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!
    if (current.key === goalKey) break

    const { col: cc, row: cr } = parseKey(current.key)
    const baseG = gScore.get(current.key) ?? Infinity

    for (const { dc, dr } of CARDINAL) {
      const nc = cc + dc
      const nr = cr + dr
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      if (!walkable[nr]![nc]) continue

      const nKey = cellKey(nc, nr)
      const tentative = baseG + 1
      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue

      gScore.set(nKey, tentative)
      cameFrom.set(nKey, current.key)
      open.push({
        key: nKey,
        f: tentative + euclideanGrid({ col: nc, row: nr }, to),
      })
    }
  }

  if (!cameFrom.has(goalKey)) return null

  const path: GridCoord[] = []
  let key: string | null = goalKey
  while (key) {
    path.push(parseKey(key))
    key = cameFrom.get(key) ?? null
  }
  path.reverse()
  return path.length >= 1 ? path : null
}

function buildLocalClearanceField(
  walkable: boolean[][],
  rows: number,
  cols: number,
  cellFt: number
): number[][] {
  const dist = Array.from({ length: rows }, () => Array<number>(cols).fill(0))
  const queue: GridCoord[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (walkable[r]![c]) continue
      dist[r]![c] = 0
      queue.push({ col: c, row: r })
    }
  }

  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]!
    const base = dist[cur.row]![cur.col]!
    for (const { dc, dr } of CARDINAL) {
      const nr = cur.row + dr
      const nc = cur.col + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      const next = base + 1
      if (next >= (dist[nr]![nc] ?? Infinity)) continue
      dist[nr]![nc] = next
      queue.push({ col: nc, row: nr })
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!walkable[r]![c]) {
        dist[r]![c] = 0
        continue
      }
      dist[r]![c] = (dist[r]![c] ?? 0) * cellFt
    }
  }

  return dist
}

export function astarGridClearanceBiased(
  walkable: boolean[][],
  start: GridCoord,
  goal: GridCoord,
  cols: number,
  rows: number,
  localClearanceFt: number[][],
  idealClearanceFt = IDEAL_PEDESTRIAN_AISLE_FT
): GridCoord[] | null {
  const from = snapToWalkable(start.col, start.row, walkable, cols, rows)
  const to = snapToWalkable(goal.col, goal.row, walkable, cols, rows)
  if (!from || !to) return null

  const goalKey = cellKey(to.col, to.row)
  const open: Array<{ key: string; f: number }> = []
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string | null>()
  const startKey = cellKey(from.col, from.row)
  gScore.set(startKey, 0)
  cameFrom.set(startKey, null)
  open.push({ key: startKey, f: euclideanGrid(from, to) })

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!
    if (current.key === goalKey) break

    const { col: cc, row: cr } = parseKey(current.key)
    const baseG = gScore.get(current.key) ?? Infinity

    for (const { dc, dr } of CARDINAL) {
      const nc = cc + dc
      const nr = cr + dr
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      if (!walkable[nr]![nc]) continue

      const clearance = localClearanceFt[nr]![nc] ?? 0
      const pinch = clearance < idealClearanceFt ? (idealClearanceFt - clearance) * 0.35 : 0
      const stepCost = 1 + pinch
      const nKey = cellKey(nc, nr)
      const tentative = baseG + stepCost
      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue

      gScore.set(nKey, tentative)
      cameFrom.set(nKey, current.key)
      open.push({
        key: nKey,
        f: tentative + euclideanGrid({ col: nc, row: nr }, to),
      })
    }
  }

  if (!cameFrom.has(goalKey)) return null

  const path: GridCoord[] = []
  let key: string | null = goalKey
  while (key) {
    path.push(parseKey(key))
    key = cameFrom.get(key) ?? null
  }
  path.reverse()
  return path.length >= 1 ? path : null
}

function astarGridDistance(
  grid: NavigationGrid,
  localClearanceFt: number[][],
  a: PathPoint,
  b: PathPoint,
  useClearanceBias: boolean
): number {
  const from = ftToGrid(a, grid.originX, grid.originY, grid.cellFt)
  const to = ftToGrid(b, grid.originX, grid.originY, grid.cellFt)
  const path = useClearanceBias
    ? astarGridClearanceBiased(
        grid.walkable,
        from,
        to,
        grid.cols,
        grid.rows,
        localClearanceFt
      )
    : astarGrid(grid.walkable, from, to, grid.cols, grid.rows)
  if (!path) return Infinity
  return gridPathDistance(path, grid.cellFt)
}

function detectPathfindingBottleneckBooths(
  path: GridCoord[],
  localClearanceFt: number[][],
  booths: ReadonlyArray<BoothObject>,
  idealClearanceFt: number,
  originX: number,
  originY: number,
  cellFt: number
): string[] {
  const ids = new Set<string>()
  for (const cell of path) {
    const clearance = localClearanceFt[cell.row]?.[cell.col] ?? 0
    if (clearance >= idealClearanceFt) continue
    const px = originX + (cell.col + 0.5) * cellFt
    const py = originY + (cell.row + 0.5) * cellFt
    for (const booth of booths) {
      const aabb = rotatedAabb(booth)
      const expanded = {
        x: aabb.x - idealClearanceFt,
        y: aabb.y - idealClearanceFt,
        width: aabb.width + idealClearanceFt * 2,
        height: aabb.height + idealClearanceFt * 2,
      }
      if (
        px >= expanded.x &&
        px <= expanded.x + expanded.width &&
        py >= expanded.y &&
        py <= expanded.y + expanded.height
      ) {
        ids.add(booth.id)
      }
    }
  }
  return [...ids]
}

function gridPathDistance(path: GridCoord[], cellFt: number): number {
  if (path.length < 2) return 0
  let dist = 0
  for (let i = 1; i < path.length; i++) {
    dist += euclideanGrid(path[i - 1]!, path[i]!) * cellFt
  }
  return dist
}

function smoothGridSegment(
  segment: GridCoord[],
  walkable: boolean[][],
  cols: number,
  rows: number
): GridCoord[] {
  if (segment.length <= 2) return segment
  return stringPullGridPath(segment, walkable, cols, rows)
}

function routePatronPathOnGrid(input: {
  walkable: boolean[][]
  cols: number
  rows: number
  originX: number
  originY: number
  cellFt: number
  waypoints: RouteWaypoint[]
  vendorBooths: BoothObject[]
  useClearanceBias: boolean
}): {
  path: PathPoint[]
  pathSegments: PathPoint[][]
  totalDistanceFt: number
  gridSegments: GridCoord[][]
  bottleneckBoothIds: string[]
  visitedBoothIds: string[]
  missedBoothIds: string[]
  isPartial: boolean
} {
  const {
    walkable,
    cols,
    rows,
    originX,
    originY,
    cellFt,
    waypoints,
    vendorBooths,
    useClearanceBias,
  } = input
  const localClearanceFt = buildLocalClearanceField(walkable, rows, cols, cellFt)
  const gridSegments: GridCoord[][] = []
  const pathSegments: PathPoint[][] = []
  let totalDistanceFt = 0
  let failedLegs = 0
  const visitedBoothIds: string[] = []
  const missedBoothIds: string[] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const target = waypoints[i + 1]!
    const a = ftToGrid(waypoints[i]!.point, originX, originY, cellFt)
    const b = ftToGrid(target.point, originX, originY, cellFt)
    const raw = useClearanceBias
      ? astarGridClearanceBiased(walkable, a, b, cols, rows, localClearanceFt)
      : astarGrid(walkable, a, b, cols, rows)

    if (!raw) {
      failedLegs++
      if (target.boothId) missedBoothIds.push(target.boothId)
      continue
    }

    const segment = smoothGridSegment(raw, walkable, cols, rows)
    gridSegments.push(segment)
    totalDistanceFt += gridPathDistance(segment, cellFt)

    const ftSegment = segment.map((g) => gridToFt(g, originX, originY, cellFt))
    pathSegments.push(ftSegment)

    if (target.boothId) visitedBoothIds.push(target.boothId)
  }

  const merged = mergeGridPaths(gridSegments)
  const path = merged.map((g) => gridToFt(g, originX, originY, cellFt))
  const bottleneckBoothIds = detectPathfindingBottleneckBooths(
    merged,
    localClearanceFt,
    vendorBooths,
    BOOTH_CLEARANCE_GOOD_FT,
    originX,
    originY,
    cellFt
  )

  return {
    path,
    pathSegments,
    totalDistanceFt,
    gridSegments,
    bottleneckBoothIds,
    visitedBoothIds,
    missedBoothIds,
    isPartial: failedLegs > 0 || missedBoothIds.length > 0,
  }
}

interface BoothApproach {
  boothId: string
  point: PathPoint
}

function buildBoothApproaches(
  booths: BoothObject[],
  grid: NavigationGrid,
  start: PathPoint,
  localClearanceFt: number[][]
): BoothApproach[] {
  const approaches: BoothApproach[] = []
  let cursor = start
  for (const booth of booths) {
    const point = resolveBoothApproachPoint(booth, grid, cursor, localClearanceFt)
    if (point) {
      approaches.push({ boothId: booth.id, point })
      cursor = point
    }
  }
  return approaches
}

function nearestNeighborBoothOrder(
  start: PathPoint,
  booths: BoothObject[],
  grid: NavigationGrid,
  localClearanceFt: number[][],
  useClearanceBias: boolean
): BoothObject[] {
  const remaining = [...booths]
  const ordered: BoothObject[] = []
  let current = start

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const booth = remaining[i]!
      const probe =
        resolveBoothApproachPoint(booth, grid, current, localClearanceFt) ??
        centerOf(booth)
      const d = astarGridDistance(
        grid,
        localClearanceFt,
        current,
        probe,
        useClearanceBias
      )
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!
    ordered.push(next)
    const approach =
      resolveBoothApproachPoint(next, grid, current, localClearanceFt) ??
      centerOf(next)
    current = approach
  }
  return ordered
}

function twoOptImproveBoothOrder(
  start: PathPoint,
  exit: PathPoint | null,
  booths: BoothObject[],
  grid: NavigationGrid,
  localClearanceFt: number[][],
  useClearanceBias: boolean
): BoothObject[] {
  if (booths.length < 3) return booths

  const routeLength = (order: BoothObject[]): number => {
    const stops = buildBoothApproaches(order, grid, start, localClearanceFt)
    if (stops.length === 0) return Infinity
    let total = 0
    let cursor = start
    for (const stop of stops) {
      total += astarGridDistance(
        grid,
        localClearanceFt,
        cursor,
        stop.point,
        useClearanceBias
      )
      cursor = stop.point
    }
    if (exit) {
      total += astarGridDistance(grid, localClearanceFt, cursor, exit, useClearanceBias)
    }
    return total
  }

  let improved = true
  let order = [...booths]
  while (improved) {
    improved = false
    for (let i = 0; i < order.length - 2; i++) {
      for (let k = i + 1; k < order.length - 1; k++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ]
        if (routeLength(candidate) + 1e-6 < routeLength(order)) {
          order = candidate
          improved = true
        }
      }
    }
  }
  return order
}

function mergeGridPaths(paths: GridCoord[][]): GridCoord[] {
  const out: GridCoord[] = []
  for (const segment of paths) {
    for (const cell of segment) {
      const last = out[out.length - 1]
      if (last && last.col === cell.col && last.row === cell.row) continue
      out.push(cell)
    }
  }
  return out
}

function buildWaypoints(
  entry: PathPoint,
  tour: BoothApproach[],
  exit: PathPoint | null
): RouteWaypoint[] {
  const waypoints: RouteWaypoint[] = [{ point: entry }]
  for (const stop of tour) {
    waypoints.push({ point: stop.point, boothId: stop.boothId })
  }
  if (exit) {
    waypoints.push({ point: exit })
  }
  return waypoints
}

/**
 * Compute the optimal patron path: entrance → every vendor booth → exit.
 * Returns null when no booths or no walkable grid cells exist.
 */
export function CalculateOptimalPath(
  doc: FloorPlanDoc,
  roomId: string,
  options: CalculateOptimalPathOptions = {}
): OptimalPathResult | null {
  const cellFt = options.cellFt ?? doc.snapFt ?? 1
  const strictBufferFt = options.obstacleBufferFt ?? MIN_CLEARANCE_FT
  const relaxedBufferFt = Math.max(1, strictBufferFt - 2)
  const roomBoundary = options.roomBoundary ?? mergedZoneRingsForRoom(doc, roomId)
  const layoutBooths = options.booths ?? vendorBoothsInRoom(doc, roomId)

  const vendorBooths = layoutBooths.filter((b) => b.x > -500)
  if (vendorBooths.length === 0) return null

  for (const [clearanceMode, bufferFt, useBias] of [
    ['strict', strictBufferFt, true],
    ['relaxed', relaxedBufferFt, true],
  ] as const) {
    const grid = buildNavigationGrid(doc, roomId, {
      cellFt,
      obstacleBufferFt: bufferFt,
      roomBoundary,
      booths: layoutBooths,
    })
    if (!grid) continue

    const terminals = resolveFlowTerminals(doc, roomId, grid)
    if (terminals.missingDoors || !terminals.entry) {
      return {
        path: [],
        pathSegments: [],
        visitOrder: [],
        totalDistanceFt: 0,
        missingDoors: true,
        isPartial: true,
        clearanceMode,
      }
    }

    const localClearanceFt = buildLocalClearanceField(
      grid.walkable,
      grid.rows,
      grid.cols,
      cellFt
    )

    const seedApproaches = buildBoothApproaches(
      vendorBooths,
      grid,
      terminals.entry,
      localClearanceFt
    )
    if (seedApproaches.length === 0) continue

    let boothOrder = nearestNeighborBoothOrder(
      terminals.entry,
      vendorBooths,
      grid,
      localClearanceFt,
      useBias
    )
    boothOrder = twoOptImproveBoothOrder(
      terminals.entry,
      terminals.exit,
      boothOrder,
      grid,
      localClearanceFt,
      useBias
    )

    const tour = buildBoothApproaches(
      boothOrder,
      grid,
      terminals.entry,
      localClearanceFt
    )

    const waypoints = buildWaypoints(terminals.entry, tour, terminals.exit)

    const routed = routePatronPathOnGrid({
      walkable: grid.walkable,
      cols: grid.cols,
      rows: grid.rows,
      originX: grid.originX,
      originY: grid.originY,
      cellFt,
      waypoints,
      vendorBooths,
      useClearanceBias: useBias,
    })

    if (routed.path.length >= 2) {
      const allBoothIds = vendorBooths.map((b) => b.id)
      const missed = allBoothIds.filter((id) => !routed.visitedBoothIds.includes(id))

      return {
        path: routed.path,
        pathSegments: routed.pathSegments,
        visitOrder: routed.visitedBoothIds,
        totalDistanceFt: routed.totalDistanceFt,
        isPartial: routed.isPartial || missed.length > 0,
        missedBoothIds: missed.length > 0 ? missed : routed.missedBoothIds,
        visitedBoothIds: routed.visitedBoothIds,
        bottleneckBoothIds: routed.bottleneckBoothIds,
        clearanceMode,
        missingDoors: false,
      }
    }
  }

  return null
}

/** Validate that path points lie on walkable navigation cells. */
export function pathPointsAreWalkable(
  path: PathPoint[],
  grid: NavigationGrid
): boolean {
  return path.every((p) => {
    const g = ftToGrid(p, grid.originX, grid.originY, grid.cellFt)
    return (
      g.row >= 0 &&
      g.col >= 0 &&
      g.row < grid.rows &&
      g.col < grid.cols &&
      grid.walkable[g.row]![g.col]
    )
  })
}
