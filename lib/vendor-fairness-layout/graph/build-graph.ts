import { DEFAULT_CELL_FT } from '../constants'
import type { Point, RotatedBooth, Room } from '../types'
import { pointInRoom, roomBoundingBox } from '../geometry/polygon'
import { rotatedAabb } from '../geometry/booth-rect'

export interface NavNode {
  id: string
  x: number
  y: number
  kind: 'entrance' | 'exit' | 'aisle' | 'booth_view'
  boothId?: string
}

export interface NavEdge {
  from: string
  to: string
  weight: number
}

export interface NavigationGraph {
  nodes: NavNode[]
  edges: NavEdge[]
  /** Grid for A* fallback. */
  walkable: boolean[][]
  cols: number
  rows: number
  originX: number
  originY: number
  cellFt: number
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function euclidean(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function buildWalkableGrid(
  room: Room,
  booths: RotatedBooth[],
  cellFt = DEFAULT_CELL_FT,
  corridorPolyline?: Point[],
  corridorWidthFt = 7
): Pick<NavigationGraph, 'walkable' | 'cols' | 'rows' | 'originX' | 'originY' | 'cellFt'> {
  const bbox = roomBoundingBox(room.boundary)
  const pad = cellFt
  const originX = bbox.x - pad
  const originY = bbox.y - pad
  const cols = Math.ceil((bbox.width + pad * 2) / cellFt)
  const rows = Math.ceil((bbox.height + pad * 2) / cellFt)
  const walkable: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  )

  const boothObstacles = booths.map((b) => {
    const aabb = rotatedAabb(b)
    return {
      x: aabb.x - 1,
      y: aabb.y - 1,
      width: aabb.width + 2,
      height: aabb.height + 2,
    }
  })

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = originX + (col + 0.5) * cellFt
      const cy = originY + (row + 0.5) * cellFt
      const p = { x: cx, y: cy }
      if (!pointInRoom(p, room.boundary)) continue
      let blocked = false
      for (const obs of boothObstacles) {
        if (
          cx >= obs.x &&
          cx <= obs.x + obs.width &&
          cy >= obs.y &&
          cy <= obs.y + obs.height
        ) {
          blocked = true
          break
        }
      }
      if (!blocked) walkable[row]![col] = true
    }
  }

  if (corridorPolyline && corridorPolyline.length >= 2) {
    const half = corridorWidthFt / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = originX + (col + 0.5) * cellFt
        const cy = originY + (row + 0.5) * cellFt
        for (let i = 0; i < corridorPolyline.length - 1; i++) {
          const a = corridorPolyline[i]!
          const b = corridorPolyline[i + 1]!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len2 = dx * dx + dy * dy || 1
          const t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / len2))
          const px = a.x + t * dx
          const py = a.y + t * dy
          if (Math.hypot(cx - px, cy - py) <= half) {
            walkable[row]![col] = true
            break
          }
        }
      }
    }
  }

  return { walkable, cols, rows, originX, originY, cellFt }
}

export function ftToGrid(
  p: Point,
  grid: Pick<NavigationGraph, 'originX' | 'originY' | 'cellFt'>
): { col: number; row: number } {
  return {
    col: Math.round((p.x - grid.originX) / grid.cellFt - 0.5),
    row: Math.round((p.y - grid.originY) / grid.cellFt - 0.5),
  }
}

export function gridToFt(
  col: number,
  row: number,
  grid: Pick<NavigationGraph, 'originX' | 'originY' | 'cellFt'>
): Point {
  return {
    x: grid.originX + (col + 0.5) * grid.cellFt,
    y: grid.originY + (row + 0.5) * grid.cellFt,
  }
}

export function buildNavigationGraph(
  room: Room,
  entrance: Point,
  exit: Point,
  booths: RotatedBooth[],
  aisleCenterline: Point[],
  corridorWidthFt: number,
  cellFt = DEFAULT_CELL_FT
): NavigationGraph {
  const grid = buildWalkableGrid(room, booths, cellFt, aisleCenterline, corridorWidthFt)
  const nodes: NavNode[] = [
    { id: 'entrance', x: entrance.x, y: entrance.y, kind: 'entrance' },
    { id: 'exit', x: exit.x, y: exit.y, kind: 'exit' },
  ]

  for (let i = 0; i < aisleCenterline.length; i++) {
    const p = aisleCenterline[i]!
    nodes.push({ id: `aisle_${i}`, x: p.x, y: p.y, kind: 'aisle' })
  }

  for (const b of booths) {
    const aabb = rotatedAabb(b)
    nodes.push({
      id: `view_${b.id}`,
      x: aabb.x + aabb.width / 2,
      y: aabb.y + aabb.height / 2,
      kind: 'booth_view',
      boothId: b.id,
    })
  }

  const edges: NavEdge[] = []
  const aisleNodes = nodes.filter((n) => n.kind === 'aisle')
  for (let i = 0; i < aisleNodes.length - 1; i++) {
    const a = aisleNodes[i]!
    const b = aisleNodes[i + 1]!
    const d = euclidean(a, b)
    edges.push({ from: a.id, to: b.id, weight: d })
    edges.push({ from: b.id, to: a.id, weight: d })
  }

  const spineIds = new Set(aisleNodes.map((n) => n.id))
  spineIds.add('entrance')
  spineIds.add('exit')

  const connectNearest = (node: NavNode, targets: NavNode[], k: number, maxDist: number) => {
    const sorted = targets
      .map((t) => ({ t, d: euclidean(node, t) }))
      .filter(({ d }) => d <= maxDist)
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
    for (const { t, d } of sorted) {
      edges.push({ from: node.id, to: t.id, weight: d })
      edges.push({ from: t.id, to: node.id, weight: d })
    }
  }

  const maxLinkDist = cellFt * 12
  const entranceNode = nodes[0]!
  const exitNode = nodes[1]!
  connectNearest(entranceNode, aisleNodes, 2, maxLinkDist)
  connectNearest(exitNode, aisleNodes, 2, maxLinkDist)

  const viewNodes = nodes.filter((n) => n.kind === 'booth_view')
  for (const v of viewNodes) {
    connectNearest(v, aisleNodes, 3, maxLinkDist)
  }

  if (booths.length <= 40) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const d = euclidean(a, b)
        if (d <= maxLinkDist) {
          edges.push({ from: a.id, to: b.id, weight: d })
          edges.push({ from: b.id, to: a.id, weight: d })
        }
      }
    }
  }

  return { nodes, edges, ...grid }
}

export { cellKey, euclidean }
