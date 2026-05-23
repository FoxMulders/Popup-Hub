/** Spatial quadtree index for category-aware placement scoring. */

export interface CategoryPoint {
  r: number
  c: number
  categoryKey: string
}

interface Bounds {
  minR: number
  maxR: number
  minC: number
  maxC: number
}

class QuadNode {
  bounds: Bounds
  points: CategoryPoint[] = []
  children: [QuadNode, QuadNode, QuadNode, QuadNode] | null = null

  constructor(bounds: Bounds) {
    this.bounds = bounds
  }

  contains(r: number, c: number): boolean {
    const { minR, maxR, minC, maxC } = this.bounds
    return r >= minR && r <= maxR && c >= minC && c <= maxC
  }

  subdivide(): void {
    const { minR, maxR, minC, maxC } = this.bounds
    const midR = (minR + maxR) / 2
    const midC = (minC + maxC) / 2
    this.children = [
      new QuadNode({ minR, maxR: midR, minC, maxC: midC }),
      new QuadNode({ minR, maxR: midR, minC: midC + 1, maxC }),
      new QuadNode({ minR: midR + 1, maxR, minC, maxC: midC }),
      new QuadNode({ minR: midR + 1, maxR, minC: midC + 1, maxC }),
    ]
  }
}

const NODE_CAPACITY = 8

function insertPoint(node: QuadNode, point: CategoryPoint): void {
  if (!node.contains(point.r, point.c)) return

  if (node.points.length < NODE_CAPACITY && !node.children) {
    node.points.push(point)
    return
  }

  if (!node.children) {
    const existing = [...node.points]
    node.points = []
    node.subdivide()
    for (const p of existing) insertPoint(node, p)
  }

  for (const child of node.children!) {
    insertPoint(child, point)
  }
}

function querySameCategory(
  node: QuadNode,
  r: number,
  c: number,
  categoryKey: string,
  out: CategoryPoint[]
): void {
  if (!node.contains(r, c) && !boundsNearPoint(node.bounds, r, c, 512)) return

  for (const p of node.points) {
    if (p.categoryKey === categoryKey) out.push(p)
  }

  if (node.children) {
    for (const child of node.children) {
      querySameCategory(child, r, c, categoryKey, out)
    }
  }
}

function boundsNearPoint(bounds: Bounds, r: number, c: number, maxDist: number): boolean {
  const nearestR = Math.max(bounds.minR, Math.min(r, bounds.maxR))
  const nearestC = Math.max(bounds.minC, Math.min(c, bounds.maxC))
  const dr = r - nearestR
  const dc = c - nearestC
  return dr * dr + dc * dc <= maxDist * maxDist
}

function manhattan(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2)
}

export class CategorySpatialIndex {
  private root: QuadNode
  readonly rows: number
  readonly cols: number

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.root = new QuadNode({ minR: 0, maxR: Math.max(0, rows - 1), minC: 0, maxC: Math.max(0, cols - 1) })
  }

  insert(r: number, c: number, categoryKey: string): void {
    insertPoint(this.root, { r, c, categoryKey })
  }

  /** Minimum Manhattan distance to any booth of the same category; venue diagonal if none. */
  minDistanceToCategory(r: number, c: number, categoryKey: string): number {
    const matches: CategoryPoint[] = []
    querySameCategory(this.root, r, c, categoryKey, matches)
    if (matches.length === 0) return this.cols + this.rows
    let min = Infinity
    for (const p of matches) {
      min = Math.min(min, manhattan(r, c, p.r, p.c))
    }
    return min
  }

  /** Score favoring opposite quadrants — higher is better for isolation. */
  quadrantSpreadScore(r: number, c: number, categoryKey: string): number {
    const matches: CategoryPoint[] = []
    querySameCategory(this.root, r, c, categoryKey, matches)
    if (matches.length === 0) return this.cols + this.rows

    const midR = this.rows / 2
    const midC = this.cols / 2
    const candidateQuad =
      (r >= midR ? 2 : 0) + (c >= midC ? 1 : 0)

    let score = 0
    for (const p of matches) {
      const quad = (p.r >= midR ? 2 : 0) + (p.c >= midC ? 1 : 0)
      if (quad !== candidateQuad) score += 4
      score += manhattan(r, c, p.r, p.c)
    }
    return score
  }
}
