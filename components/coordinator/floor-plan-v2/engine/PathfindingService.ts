/**
 * Grid-based A* pathfinding for patron traffic through the hall.
 *
 * Booths and stages are impassable. The optimal viewing path enters
 * via the entrance door, visits every vendor booth, and exits — using
 * a nearest-neighbor booth order with A* legs between waypoints.
 */

import { rotatedAabb } from '../interactions/geometry'
import { resolveRoomPlacementSurface } from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { vendorBoothsInRoom } from './BoothArrangementEngine'

export interface PathPoint {
  x: number
  y: number
}

export interface OptimalPathResult {
  path: PathPoint[]
  visitOrder: string[]
  totalDistanceFt: number
}

export interface CalculateOptimalPathOptions {
  cellFt?: number
  /** Extra clearance around impassable footprints (ft). */
  obstacleBufferFt?: number
}

interface GridCoord {
  col: number
  row: number
}

const CARDINAL = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
] as const

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function parseKey(key: string): GridCoord {
  const [col, row] = key.split(',').map(Number)
  return { col: col!, row: row! }
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

function centerOf(obj: PlacedObject): PathPoint {
  const aabb = rotatedAabb(obj)
  return {
    x: aabb.x + aabb.width / 2,
    y: aabb.y + aabb.height / 2,
  }
}

function findEntrance(objects: PlacedObject[]): PlacedObject | null {
  const doors = objects.filter((o) => o.kind === 'door')
  return (
    doors.find((d) => d.kind === 'door' && d.doorType === 'entrance') ??
    doors[0] ??
    null
  )
}

function findExit(objects: PlacedObject[]): PlacedObject | null {
  const emergency = objects.find((o) => o.kind === 'emergency_exit')
  if (emergency) return emergency
  return (
    objects.find((d) => d.kind === 'door' && d.doorType === 'exit') ?? null
  )
}

function objectsInRoom(doc: FloorPlanDoc, roomId: string): PlacedObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter((o) => objectRoom[o.id] === roomId)
}

function buildWalkabilityGrid(
  doc: FloorPlanDoc,
  roomId: string,
  cellFt: number,
  obstacleBufferFt: number
): {
  walkable: boolean[][]
  cols: number
  rows: number
  originX: number
  originY: number
} | null {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface) return null

  const originX = surface.minX
  const originY = surface.minY
  const cols = Math.max(1, Math.ceil((surface.maxX - surface.minX) / cellFt))
  const rows = Math.max(1, Math.ceil((surface.maxY - surface.minY) / cellFt))

  const walkable: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => true)
  )

  const roomObjects = objectsInRoom(doc, roomId)
  const impassable = roomObjects.filter(
    (o) =>
      o.kind === 'booth' ||
      o.kind === 'stage' ||
      o.kind === 'wall' ||
      o.kind === 'open_wall' ||
      o.kind === 'food_truck'
  )

  for (const obj of impassable) {
    const aabb = rotatedAabb(obj)
    const minCol = Math.floor((aabb.x - obstacleBufferFt - originX) / cellFt)
    const maxCol = Math.ceil(
      (aabb.x + aabb.width + obstacleBufferFt - originX) / cellFt
    )
    const minRow = Math.floor((aabb.y - obstacleBufferFt - originY) / cellFt)
    const maxRow = Math.ceil(
      (aabb.y + aabb.height + obstacleBufferFt - originY) / cellFt
    )
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) walkable[r]![c] = false
      }
    }
  }

  return { walkable, cols, rows, originX, originY }
}

function snapToWalkable(
  col: number,
  row: number,
  walkable: boolean[][],
  cols: number,
  rows: number
): GridCoord | null {
  if (
    row >= 0 &&
    row < rows &&
    col >= 0 &&
    col < cols &&
    walkable[row]![col]
  ) {
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
    col: Math.round((p.x - originX) / cellFt),
    row: Math.round((p.y - originY) / cellFt),
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

/** Lightweight A* on a cardinal grid. */
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
  open.push({ key: startKey, f: manhattan(from, to) })

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
        f: tentative + manhattan({ col: nc, row: nr }, to),
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

function gridPathDistance(path: GridCoord[], cellFt: number): number {
  if (path.length < 2) return 0
  let dist = 0
  for (let i = 1; i < path.length; i++) {
    dist += manhattan(path[i - 1]!, path[i]!) * cellFt
  }
  return dist
}

function nearestNeighborOrder(
  start: PathPoint,
  booths: BoothObject[]
): BoothObject[] {
  const remaining = [...booths]
  const ordered: BoothObject[] = []
  let cursor = start

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const b = remaining[i]!
      const c = centerOf(b)
      const d = Math.hypot(c.x - cursor.x, c.y - cursor.y)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!
    ordered.push(next)
    cursor = centerOf(next)
  }
  return ordered
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

/**
 * Compute the optimal viewing path: entrance → every vendor booth → exit.
 * Returns null when entrance/exit fixtures or walkable grid are unavailable.
 */
export function CalculateOptimalPath(
  doc: FloorPlanDoc,
  roomId: string,
  options: CalculateOptimalPathOptions = {}
): OptimalPathResult | null {
  const cellFt = options.cellFt ?? (doc.snapFt || 1)
  const obstacleBufferFt = options.obstacleBufferFt ?? 1

  const roomObjects = objectsInRoom(doc, roomId)
  const entrance = findEntrance(roomObjects)
  const exit = findExit(roomObjects) ?? findEntrance(doc.objects)
  if (!entrance || !exit) return null

  const grid = buildWalkabilityGrid(doc, roomId, cellFt, obstacleBufferFt)
  if (!grid) return null

  const { walkable, cols, rows, originX, originY } = grid
  const startFt = centerOf(entrance)
  const endFt = centerOf(exit)

  const vendorBooths = vendorBoothsInRoom(doc, roomId).filter(
    (b) => b.x > -500
  )
  const ordered = nearestNeighborOrder(startFt, vendorBooths)

  const waypoints: PathPoint[] = [
    startFt,
    ...ordered.map((b) => centerOf(b)),
    endFt,
  ]

  const gridSegments: GridCoord[][] = []
  let totalDistanceFt = 0
  const visitOrder = ordered.map((b) => b.id)

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = ftToGrid(waypoints[i]!, originX, originY, cellFt)
    const b = ftToGrid(waypoints[i + 1]!, originX, originY, cellFt)
    const segment = astarGrid(walkable, a, b, cols, rows)
    if (!segment) continue
    gridSegments.push(segment)
    totalDistanceFt += gridPathDistance(segment, cellFt)
  }

  if (gridSegments.length === 0) return null

  const merged = mergeGridPaths(gridSegments)
  const path = merged.map((g) => gridToFt(g, originX, originY, cellFt))

  return { path, visitOrder, totalDistanceFt }
}
