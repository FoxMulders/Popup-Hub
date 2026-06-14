import type { Entrance, Exit, Point, Room, RotatedBooth } from '../types'
import type { AisleSkeleton } from '../types'
import { buildNavigationGraph } from '../graph/build-graph'
import { euclidean } from '../graph/build-graph'
import { dijkstra, dijkstraPathPoints, stitchGridPaths } from './pathfinding'
import { nearestNeighborOrder, twoOptImprove } from './tsp'

export interface RouteResult {
  route: Point[]
  visitOrder: string[]
  totalDistanceFt: number
  missedBoothIds: string[]
}

function boothNodeId(boothId: string): string {
  return `view_${boothId}`
}

function cumulativeDistances(line: Point[]): number[] {
  const d = [0]
  for (let i = 1; i < line.length; i++) {
    d.push(d[i - 1]! + euclidean(line[i - 1]!, line[i]!))
  }
  return d
}

function projectOntoPolyline(p: Point, line: Point[]): number {
  let best = Infinity
  let bestT = 0
  let cum = 0
  const cumDist = cumulativeDistances(line)
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!
    const b = line[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const px = a.x + t * dx
    const py = a.y + t * dy
    const dist = Math.hypot(p.x - px, p.y - py)
    if (dist < best) {
      best = dist
      bestT = cumDist[i]! + Math.sqrt(len2) * t
    }
    cum += Math.sqrt(len2)
  }
  void cum
  return bestT
}

/** Fast snake-order route for large booth counts — avoids N× Dijkstra. */
function generateSnakeRoute(
  start: Point,
  end: Point,
  booths: RotatedBooth[],
  aisle: AisleSkeleton
): RouteResult {
  const spine = aisle.centerline.length >= 2 ? aisle.centerline : [start, end]
  const sorted = [...booths].sort((a, b) => {
    const ca = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
    const cb = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    return projectOntoPolyline(ca, spine) - projectOntoPolyline(cb, spine)
  })
  const visitOrder = sorted.map((b) => b.id)
  const route: Point[] = [{ ...start }]
  for (const p of spine) route.push({ ...p })
  for (const b of sorted) {
    route.push({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
  }
  route.push({ ...end })
  const deduped = stitchGridPaths([route])
  let total = 0
  for (let i = 1; i < deduped.length; i++) {
    total += euclidean(deduped[i - 1]!, deduped[i]!)
  }
  return { route: deduped, visitOrder, totalDistanceFt: total, missedBoothIds: [] }
}

export function generateRoute(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  booths: RotatedBooth[],
  aisle: AisleSkeleton,
  cellFt?: number
): RouteResult {
  const start: Point = { x: entrance.x, y: entrance.y }
  const end: Point = { x: exit.x, y: exit.y }

  if (booths.length > 80) {
    return generateSnakeRoute(start, end, booths, aisle)
  }

  const graph = buildNavigationGraph(
    room,
    start,
    end,
    booths,
    aisle.centerline,
    aisle.widthFt,
    cellFt
  )

  const boothIds = booths.map((b) => b.id)
  let visitOrder = nearestNeighborOrder(graph, boothIds, start)
  visitOrder = twoOptImprove(graph, visitOrder, start, end, 80)

  const segments: Point[][] = []
  let curNodeId = 'entrance'
  const visited = new Set<string>()

  for (const id of visitOrder) {
    const targetId = boothNodeId(id)
    if (!graph.nodes.some((n) => n.id === targetId)) continue
    segments.push(dijkstraPathPoints(graph, curNodeId, targetId))
    curNodeId = targetId
    visited.add(id)
  }
  segments.push(dijkstraPathPoints(graph, curNodeId, 'exit'))

  const route = stitchGridPaths(segments)
  const missedBoothIds = boothIds.filter((id) => !visited.has(id))
  const { distance } = dijkstra(graph, 'entrance', 'exit')

  return {
    route: route.length >= 2 ? route : [start, ...aisle.centerline, end],
    visitOrder,
    totalDistanceFt: distance,
    missedBoothIds,
  }
}
