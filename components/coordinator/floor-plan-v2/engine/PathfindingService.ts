/**

 * Grid-based A* pathfinding for patron traffic through the hall.

 *

 * Walkable cells lie inside merged_zone / room boundary polygons.

 * Booths, stages, and walls are impassable. The patron tour uses

 * nearest-neighbor booth ordering (TSP heuristic) with A* legs between

 * waypoints and a Euclidean distance heuristic: f(n) = g(n) + h(n).

 */



import { pointInAnyRing } from '../geometry/point-in-polygon'

import { rotatedAabb, type Rect } from '../interactions/geometry'

import {

  resolveRoomPlacementSurface,

  type PlacementRing,

} from '../state/placement-surface'

import { objectFootprintAabb } from '../state/table-cluster-layout'

import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'

import { MIN_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'

import { mergedZoneRingsForRoom, vendorBoothsInRoom } from './BoothArrangementEngine'



export interface PathPoint {

  x: number

  y: number

}



export interface OptimalPathResult {

  path: PathPoint[]

  visitOrder: string[]

  totalDistanceFt: number

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

  /** Grid resolution — feet per cell (default: doc.snapFt or 1). */

  cellFt?: number

  /** Extra clearance around impassable footprints (ft). */

  obstacleBufferFt?: number

  /** Override vendor booths (defaults to vendor booths in room). */

  booths?: ReadonlyArray<BoothObject>

  /** Walkable boundary rings (defaults to merged_zone / room surface). */

  roomBoundary?: ReadonlyArray<PlacementRing>

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



const IMPASSABLE_KINDS = new Set<PlacedObject['kind']>(['booth', 'stage', 'wall'])

/** Booths packed off-canvas use this sentinel — skip for obstacle carving. */
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



/** Full compound footprint for booths (table clusters); rotated AABB otherwise. */

function obstacleFootprintAabb(obj: PlacedObject): Rect {

  if (obj.kind === 'booth') {

    return objectFootprintAabb(obj)

  }

  return rotatedAabb(obj)

}



/**

 * Active layout obstacles: impassable room fixtures plus every vendor booth

 * in the current layout (explicit list wins over doc.objects alone).

 */

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

  const maxCol = Math.ceil(

    (aabb.x + aabb.width + paddingFt - originX) / cellFt

  )

  const minRow = Math.floor((aabb.y - paddingFt - originY) / cellFt)

  const maxRow = Math.ceil(

    (aabb.y + aabb.height + paddingFt - originY) / cellFt

  )



  for (let row = minRow; row <= maxRow; row++) {

    for (let col = minCol; col <= maxCol; col++) {

      if (row >= 0 && row < rows && col >= 0 && col < cols) {

        walkable[row]![col] = false

      }

    }

  }

}



/**

 * Secondary guard — widen clearance one extra cell where two booth edges

 * meet at a diagonal so paths hug aisles instead of clipping corners.

 */

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



/**

 * Build a navigation grid from merged_zone / room boundary polygons.

 * Cells outside the walkable boundary or occupied by booth/stage/wall

 * footprints are blocked.

 */

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



  // Mark every booth/stage/wall footprint plus its 3′ safety buffer as impassable.
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



  // Pass 3 — trim diagonal pinch cells adjacent to blocked booth edges.

  applyCornerClearanceGuard(walkable, rows, cols)



  // A* cardinal adjacency reads the final walkable[][] — blocked cells

  // implicitly drop their graph edges on the next path query.



  return { walkable, cols, rows, originX, originY, cellFt }

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



/** A* on a cardinal grid with Euclidean heuristic h(n). */

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

      const stepCost = 1

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



function gridPathDistance(path: GridCoord[], cellFt: number): number {

  if (path.length < 2) return 0

  let dist = 0

  for (let i = 1; i < path.length; i++) {

    dist += euclideanGrid(path[i - 1]!, path[i]!) * cellFt

  }

  return dist

}



/** Nearest-neighbor TSP heuristic for booth visit order. */

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

 * Compute the optimal patron path: entrance (when present) → every

 * vendor booth → exit (when present). Returns null when no booths or

 * no walkable grid cells exist.

 */

export function CalculateOptimalPath(

  doc: FloorPlanDoc,

  roomId: string,

  options: CalculateOptimalPathOptions = {}

): OptimalPathResult | null {

  const cellFt = options.cellFt ?? doc.snapFt ?? 1

  const obstacleBufferFt = options.obstacleBufferFt ?? MIN_CLEARANCE_FT

  const roomBoundary =

    options.roomBoundary ?? mergedZoneRingsForRoom(doc, roomId)

  const layoutBooths = options.booths ?? vendorBoothsInRoom(doc, roomId)



  const grid = buildNavigationGrid(doc, roomId, {

    cellFt,

    obstacleBufferFt,

    roomBoundary,

    booths: layoutBooths,

  })

  if (!grid) return null



  const { walkable, cols, rows, originX, originY } = grid

  const roomObjects = objectsInRoom(doc, roomId)

  const entrance = findEntrance(roomObjects)

  const exit = findExit(roomObjects)



  const boundary = resolveWalkableRings(doc, roomId, roomBoundary)

  const fallbackStart = boundary?.centroid ?? { x: originX, y: originY }



  const vendorBooths = layoutBooths.filter((b) => b.x > -500)



  if (vendorBooths.length === 0) return null



  const startFt = entrance ? centerOf(entrance) : fallbackStart

  const ordered = nearestNeighborOrder(startFt, vendorBooths)



  const waypoints: PathPoint[] = [

    startFt,

    ...ordered.map((b) => centerOf(b)),

  ]

  if (exit) {

    waypoints.push(centerOf(exit))

  }



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


