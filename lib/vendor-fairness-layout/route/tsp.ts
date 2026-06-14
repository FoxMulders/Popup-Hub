import type { Point } from '../types'
import type { NavigationGraph } from '../graph/build-graph'
import { euclidean } from '../graph/build-graph'

/** Nearest-neighbor booth visit order from entrance. */
export function nearestNeighborOrder(
  graph: NavigationGraph,
  boothIds: string[],
  start: Point
): string[] {
  const viewNodes = graph.nodes.filter((n) => n.kind === 'booth_view')
  const byId = new Map(viewNodes.map((n) => [n.boothId!, n]))
  const remaining = new Set(boothIds)
  const order: string[] = []
  let current = start

  while (remaining.size > 0) {
    let bestId = ''
    let bestDist = Infinity
    for (const id of remaining) {
      const node = byId.get(id)
      if (!node) continue
      const d = euclidean(current, node)
      if (d < bestDist) {
        bestDist = d
        bestId = id
      }
    }
    if (!bestId) break
    order.push(bestId)
    remaining.delete(bestId)
    current = byId.get(bestId)!
  }
  return order
}

function tourLength(graph: NavigationGraph, order: string[], start: Point, end: Point): number {
  const viewNodes = graph.nodes.filter((n) => n.kind === 'booth_view')
  const byId = new Map(viewNodes.map((n) => [n.boothId!, n]))
  let total = 0
  let cur = start
  for (const id of order) {
    const node = byId.get(id)
    if (!node) continue
    total += euclidean(cur, node)
    cur = node
  }
  total += euclidean(cur, end)
  return total
}

/** 2-opt improvement on booth visit order (Hamiltonian path approximation). */
export function twoOptImprove(
  graph: NavigationGraph,
  order: string[],
  start: Point,
  end: Point,
  maxIterations = 100
): string[] {
  let best = [...order]
  let bestLen = tourLength(graph, best, start, end)
  let improved = true
  let iter = 0

  while (improved && iter < maxIterations) {
    improved = false
    iter++
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i + 1),
          ...best.slice(i + 1, j + 1).reverse(),
          ...best.slice(j + 1),
        ]
        const len = tourLength(graph, candidate, start, end)
        if (len + 1e-6 < bestLen) {
          best = candidate
          bestLen = len
          improved = true
        }
      }
    }
  }
  return best
}

export function boothViewPointForId(graph: NavigationGraph, boothId: string): Point | null {
  const node = graph.nodes.find((n) => n.boothId === boothId)
  return node ? { x: node.x, y: node.y } : null
}
