import type { Point } from '../types'
import type { NavigationGraph, NavNode } from '../graph/build-graph'
import { cellKey, euclidean, ftToGrid, gridToFt } from '../graph/build-graph'

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

function inBounds(g: NavigationGraph, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < g.cols && row < g.rows
}

function gridHeuristic(a: GridCoord, b: GridCoord): number {
  return Math.hypot(a.col - b.col, a.row - b.row)
}

/** A* on walkable grid cells. Returns polyline in ft space. */
export function astarGrid(
  graph: NavigationGraph,
  start: Point,
  goal: Point
): Point[] {
  const startG = ftToGrid(start, graph)
  const goalG = ftToGrid(goal, graph)
  if (
    !inBounds(graph, startG.col, startG.row) ||
    !inBounds(graph, goalG.col, goalG.row)
  ) {
    return [start, goal]
  }

  const open = new Set<string>([cellKey(startG.col, startG.row)])
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()
  const startKey = cellKey(startG.col, startG.row)
  const goalKey = cellKey(goalG.col, goalG.row)
  gScore.set(startKey, 0)
  fScore.set(startKey, gridHeuristic(startG, goalG))

  while (open.size > 0) {
    let currentKey = ''
    let bestF = Infinity
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity
      if (f < bestF) {
        bestF = f
        currentKey = k
      }
    }
    if (currentKey === goalKey) {
      const path: Point[] = []
      let ck: string | undefined = currentKey
      while (ck) {
        const [col, row] = ck.split(',').map(Number) as [number, number]
        path.unshift(gridToFt(col, row, graph))
        ck = cameFrom.get(ck)
      }
      return path
    }
    open.delete(currentKey)
    const [cc, cr] = currentKey.split(',').map(Number) as [number, number]
    for (const { dc, dr } of CARDINAL) {
      const nc = cc + dc
      const nr = cr + dr
      if (!inBounds(graph, nc, nr) || !graph.walkable[nr]![nc]) continue
      const nk = cellKey(nc, nr)
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue
      cameFrom.set(nk, currentKey)
      gScore.set(nk, tentative)
      fScore.set(nk, tentative + gridHeuristic({ col: nc, row: nr }, goalG))
      open.add(nk)
    }
  }

  return [start, goal]
}

/** Dijkstra on explicit graph edges. */
export function dijkstra(
  graph: NavigationGraph,
  startId: string,
  goalId: string
): { path: string[]; distance: number } {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const adj = new Map<string, Array<{ to: string; weight: number }>>()
  for (const e of graph.edges) {
    const list = adj.get(e.from) ?? []
    list.push({ to: e.to, weight: e.weight })
    adj.set(e.from, list)
  }

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const unvisited = new Set(graph.nodes.map((n) => n.id))
  for (const n of graph.nodes) dist.set(n.id, Infinity)
  dist.set(startId, 0)

  while (unvisited.size > 0) {
    let u = ''
    let best = Infinity
    for (const id of unvisited) {
      const d = dist.get(id) ?? Infinity
      if (d < best) {
        best = d
        u = id
      }
    }
    if (!u || u === goalId || best === Infinity) break
    unvisited.delete(u)
    for (const { to, weight } of adj.get(u) ?? []) {
      if (!unvisited.has(to)) continue
      const alt = (dist.get(u) ?? Infinity) + weight
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt)
        prev.set(to, u)
      }
    }
  }

  const path: string[] = []
  let cur: string | undefined = goalId
  while (cur) {
    path.unshift(cur)
    cur = prev.get(cur)
  }
  if (path[0] !== startId) {
    const a = nodeById.get(startId)
    const b = nodeById.get(goalId)
    if (a && b) return { path: [startId, goalId], distance: euclidean(a, b) }
    return { path: [startId], distance: Infinity }
  }
  return { path, distance: dist.get(goalId) ?? Infinity }
}

export function dijkstraPathPoints(
  graph: NavigationGraph,
  startId: string,
  goalId: string
): Point[] {
  const { path } = dijkstra(graph, startId, goalId)
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  return path
    .map((id) => nodeById.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({ x: n.x, y: n.y }))
}

export function nearestNodeId(graph: NavigationGraph, p: Point, kinds?: Set<NavNode['kind']>): string {
  let best = graph.nodes[0]!.id
  let bestD = Infinity
  for (const n of graph.nodes) {
    if (kinds && !kinds.has(n.kind)) continue
    const d = euclidean(p, n)
    if (d < bestD) {
      bestD = d
      best = n.id
    }
  }
  return best
}

export function stitchGridPaths(segments: Point[][]): Point[] {
  const out: Point[] = []
  for (const seg of segments) {
    for (const p of seg) {
      const last = out[out.length - 1]
      if (!last || euclidean(last, p) > 0.01) out.push(p)
    }
  }
  return out
}
