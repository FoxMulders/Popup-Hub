import { cellKey } from '@/lib/booth-planner/venue-elements'
import {
  buildPathTrace,
  buildWalkabilityGrid,
  getCenterlineWalkwayKeys,
  getEntranceWalkPoint,
  snapToWalkableCell,
  type PatronPathPoint,
  type PatronPathTrace,
} from '@/lib/booth-planner/patron-path-trace'
import { getRoomCanvasMetrics, type RoomCanvasMetrics } from '@/lib/shopper/room-canvas'
import type { BoothCell, LayoutRoom } from '@/types/database'

export type ShopperRouteMode = 'baseline' | 'vendor' | 'exposition'

const CARDINAL = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
] as const

interface AStarNode {
  key: string
  f: number
}

function manhattan(a: PatronPathPoint, b: PatronPathPoint): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

function parseKey(key: string): PatronPathPoint {
  const [row, col] = key.split('-').map(Number)
  return { row, col }
}

/** A* on the walkable aisle grid — prefers centerline cells when provided. */
export function astarWalkRoute(
  walkable: boolean[][],
  start: PatronPathPoint,
  end: PatronPathPoint,
  rows: number,
  cols: number,
  centerline?: Set<string>
): PatronPathPoint[] | null {
  const from = snapToWalkableCell(start.row, start.col, walkable, rows, cols)
  const to = snapToWalkableCell(end.row, end.col, walkable, rows, cols)
  if (!from || !to) return null

  const goalKey = cellKey(to.row, to.col)
  const open: AStarNode[] = []
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string | null>()

  const startKey = cellKey(from.row, from.col)
  gScore.set(startKey, 0)
  cameFrom.set(startKey, null)
  open.push({ key: startKey, f: manhattan(from, to) })

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!
    if (current.key === goalKey) break

    const { row: cr, col: cc } = parseKey(current.key)
    const baseG = gScore.get(current.key) ?? Infinity

    for (const { dr, dc } of CARDINAL) {
      const nr = cr + dr
      const nc = cc + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || !walkable[nr][nc]) continue

      const nKey = cellKey(nr, nc)
      const step = centerline?.has(nKey) ? 0.85 : 1
      const tentative = baseG + step
      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue

      gScore.set(nKey, tentative)
      cameFrom.set(nKey, current.key)
      open.push({ key: nKey, f: tentative + manhattan({ row: nr, col: nc }, to) })
    }
  }

  if (!cameFrom.has(goalKey)) return null

  const path: PatronPathPoint[] = []
  let key: string | null = goalKey
  while (key) {
    path.push(parseKey(key))
    key = cameFrom.get(key) ?? null
  }
  path.reverse()
  return path.length >= 2 ? path : null
}

function astarDistance(
  metrics: RoomCanvasMetrics,
  room: LayoutRoom,
  a: PatronPathPoint,
  b: PatronPathPoint,
  centerline: Set<string>
): number {
  const path = astarWalkRoute(
    buildWalkabilityGrid(metrics.canvasRows, metrics.cols, metrics.venueElements, metrics.placedCells),
    a,
    b,
    metrics.canvasRows,
    metrics.cols,
    centerline
  )
  if (!path) return Infinity
  let dist = 0
  for (let i = 1; i < path.length; i++) {
    dist += manhattan(path[i - 1], path[i])
  }
  return dist
}

/** Nearest walkable aisle cell in front of a vendor booth footprint. */
export function boothApproachNode(
  booth: BoothCell,
  walkable: boolean[][],
  rows: number,
  cols: number,
  preferFrom: PatronPathPoint
): PatronPathPoint | null {
  let best: PatronPathPoint | null = null
  let bestScore = Infinity

  for (let r = booth.row; r < booth.row + booth.rowSpan; r++) {
    for (let c = booth.col; c < booth.col + booth.colSpan; c++) {
      for (const { dr, dc } of CARDINAL) {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || !walkable[nr][nc]) continue
        const score = manhattan({ row: nr, col: nc }, preferFrom)
        if (score < bestScore) {
          bestScore = score
          best = { row: nr, col: nc }
        }
      }
    }
  }
  return best
}

function dedupeApproachNodes(nodes: PatronPathPoint[]): PatronPathPoint[] {
  const seen = new Set<string>()
  const out: PatronPathPoint[] = []
  for (const n of nodes) {
    const key = cellKey(n.row, n.col)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out
}

function serpentineOrder(nodes: PatronPathPoint[], hallRows: number): PatronPathPoint[] {
  const byRow = new Map<number, PatronPathPoint[]>()
  for (const n of nodes) {
    const band = n.row >= hallRows ? hallRows : Math.floor(n.row / 4) * 4
    const list = byRow.get(band) ?? []
    list.push(n)
    byRow.set(band, list)
  }
  const bands = [...byRow.keys()].sort((a, b) => a - b)
  const ordered: PatronPathPoint[] = []
  bands.forEach((band, idx) => {
    const row = [...(byRow.get(band) ?? [])].sort((a, b) => a.col - b.col)
    if (idx % 2 === 1) row.reverse()
    ordered.push(...row)
  })
  return ordered
}

function nearestNeighborTour(
  start: PatronPathPoint,
  nodes: PatronPathPoint[],
  metrics: RoomCanvasMetrics,
  room: LayoutRoom,
  centerline: Set<string>
): PatronPathPoint[] {
  const remaining = [...nodes]
  const tour: PatronPathPoint[] = [start]
  let current = start

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = astarDistance(metrics, room, current, remaining[i], centerline)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    tour.push(next)
    current = next
  }
  return tour
}

function twoOptImprove(
  tour: PatronPathPoint[],
  metrics: RoomCanvasMetrics,
  room: LayoutRoom,
  centerline: Set<string>
): PatronPathPoint[] {
  if (tour.length < 4) return tour

  const dist = (a: PatronPathPoint, b: PatronPathPoint) =>
    astarDistance(metrics, room, a, b, centerline)

  let improved = true
  let order = [...tour]
  while (improved) {
    improved = false
    for (let i = 1; i < order.length - 2; i++) {
      for (let k = i + 1; k < order.length - 1; k++) {
        const before = dist(order[i - 1], order[i]) + dist(order[k], order[k + 1])
        const after = dist(order[i - 1], order[k]) + dist(order[i], order[k + 1])
        if (after + 1e-6 < before) {
          const next = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)]
          order = next
          improved = true
        }
      }
    }
  }
  return order
}

function stitchRouteSegments(
  waypoints: PatronPathPoint[],
  walkable: boolean[][],
  rows: number,
  cols: number,
  centerline: Set<string>
): PatronPathPoint[] {
  const stitched: PatronPathPoint[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = astarWalkRoute(
      walkable,
      waypoints[i],
      waypoints[i + 1],
      rows,
      cols,
      centerline
    )
    if (!segment || segment.length < 2) continue
    if (stitched.length === 0) stitched.push(...segment)
    else stitched.push(...segment.slice(1))
  }
  return stitched
}

/** Option A — shortest aisle path from entrance to a specific vendor booth. */
export function computeVendorDirectRoute(
  room: LayoutRoom,
  booth: BoothCell
): PatronPathTrace | null {
  const metrics = getRoomCanvasMetrics(room)
  const walkable = buildWalkabilityGrid(
    metrics.canvasRows,
    metrics.cols,
    metrics.venueElements,
    metrics.placedCells
  )
  const centerline = getCenterlineWalkwayKeys(metrics.venueElements)
  const entrance = getEntranceWalkPoint(
    metrics.venueElements,
    room.entrance,
    walkable,
    metrics.canvasRows,
    metrics.cols
  )
  if (!entrance) return null

  const approach = boothApproachNode(
    booth,
    walkable,
    metrics.canvasRows,
    metrics.cols,
    entrance
  )
  if (!approach) return null

  const path = astarWalkRoute(
    walkable,
    entrance,
    approach,
    metrics.canvasRows,
    metrics.cols,
    centerline
  )
  if (!path) return null
  return buildPathTrace(path)
}

/** Option B — TSP-style serpentine tour visiting every booth approach node once. */
export function computeExpositionTourRoute(room: LayoutRoom): PatronPathTrace | null {
  const metrics = getRoomCanvasMetrics(room)
  const walkable = buildWalkabilityGrid(
    metrics.canvasRows,
    metrics.cols,
    metrics.venueElements,
    metrics.placedCells
  )
  const centerline = getCenterlineWalkwayKeys(metrics.venueElements)
  const entrance = getEntranceWalkPoint(
    metrics.venueElements,
    room.entrance,
    walkable,
    metrics.canvasRows,
    metrics.cols
  )
  if (!entrance) return null

  const approaches = dedupeApproachNodes(
    metrics.placedCells
      .map((booth) =>
        boothApproachNode(booth, walkable, metrics.canvasRows, metrics.cols, entrance)
      )
      .filter((n): n is PatronPathPoint => n != null)
  )

  if (approaches.length === 0) return null

  const serpentineSeed = serpentineOrder(approaches, metrics.hallRows)
  let tour = nearestNeighborTour(entrance, serpentineSeed, metrics, room, centerline)
  tour = twoOptImprove(tour, metrics, room, centerline)

  const stitched = stitchRouteSegments(
    tour,
    walkable,
    metrics.canvasRows,
    metrics.cols,
    centerline
  )
  if (stitched.length < 2) return null
  return buildPathTrace(stitched)
}
