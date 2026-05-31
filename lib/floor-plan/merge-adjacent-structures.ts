/**
 * Boolean union + shared-wall dissolution for floor-plan Join.
 *
 * Rectilinear rooms and stages are modeled as closed polygons; merging
 * uses `polygon-clipping` union so partial overlaps (stage tucked into
 * the bottom of a hall) produce one continuous outer perimeter.
 */

import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping'
import {
  ensureOuterRingCCW,
  guardedPolygonUnion,
  normalizePolygonForUnion,
  signedRingArea,
} from '@/lib/floor-plan/polygon-clipping-union'
import { ensurePlacementOuterRing } from '@/lib/floor-plan/placement-ring-orientation'

/** Canvas-global feet, `[x, y]`. */
export type Vec2 = readonly [number, number]

export type WallSegment2 = readonly [Vec2, Vec2]

export type WallSide = 'top' | 'bottom' | 'left' | 'right'

export interface ArchitecturalStructure {
  id: string
  /** Perimeter segments (used for barrier analysis / tests). */
  walls: ReadonlyArray<WallSegment2>
  /** Closed ring, first point repeated at end. */
  polygon: Ring
  wallSides?: ReadonlyArray<WallSide>
}

export interface MergeAdjacentStructuresResult {
  id: string
  activeWalls: WallSegment2[]
  paths: Vec2[][]
  internalBarriers: WallSegment2[]
  /** Axis-aligned bounds of the union. */
  aabb: { minX: number; minY: number; maxX: number; maxY: number }
  areaSqFt: number
}

export const DEFAULT_MERGE_EPSILON_FT = 5 / 12

const EPS = 1e-9

export function nearlyEqual(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon
}

type Axis = 'horizontal' | 'vertical' | 'other'

export interface NormalizedSeg {
  a: Vec2
  b: Vec2
  axis: Axis
  perp: number
  lo: number
  hi: number
  side?: WallSide
  directed: WallSegment2
}

function normalizeSegment(
  seg: WallSegment2,
  epsilon: number,
  side?: WallSide
): NormalizedSeg | null {
  const [p0, p1] = seg
  const dx = Math.abs(p1[0] - p0[0])
  const dy = Math.abs(p1[1] - p0[1])
  const len = Math.hypot(dx, dy)
  if (len < EPS) return null
  let axis: Axis = 'other'
  if (dy <= epsilon && dx > epsilon) axis = 'horizontal'
  else if (dx <= epsilon && dy > epsilon) axis = 'vertical'
  if (axis === 'other') return null

  const a: Vec2 =
    p0[0] < p1[0] || (nearlyEqual(p0[0], p1[0], epsilon) && p0[1] <= p1[1])
      ? p0
      : p1
  const b: Vec2 = a === p0 ? p1 : p0

  if (axis === 'horizontal') {
    const y = (a[1] + b[1]) / 2
    return {
      a,
      b,
      axis,
      perp: y,
      lo: Math.min(a[0], b[0]),
      hi: Math.max(a[0], b[0]),
      side,
      directed: seg,
    }
  }
  const x = (a[0] + b[0]) / 2
  return {
    a,
    b,
    axis,
    perp: x,
    lo: Math.min(a[1], b[1]),
    hi: Math.max(a[1], b[1]),
    side,
    directed: seg,
  }
}

function wallsFaceEachOther(a: WallSide, b: WallSide): boolean {
  return (
    (a === 'top' && b === 'bottom') ||
    (a === 'bottom' && b === 'top') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  )
}

function intervalOverlap(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
  epsilon: number
): [number, number] | null {
  const lo = Math.max(aLo, bLo)
  const hi = Math.min(aHi, bHi)
  if (hi - lo > epsilon) return [lo, hi]
  return null
}

/** Facing, collinear segments with shared interval (internal wall). */
export function segmentsAreInternalBarrier(
  sa: NormalizedSeg,
  sb: NormalizedSeg,
  epsilon: number
): boolean {
  if (sa.axis !== sb.axis) return false
  if (!nearlyEqual(sa.perp, sb.perp, epsilon)) return false
  if (sa.side && sb.side && !wallsFaceEachOther(sa.side, sb.side)) return false
  return intervalOverlap(sa.lo, sa.hi, sb.lo, sb.hi, epsilon) !== null
}

function rectToRing(
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): Ring {
  const x0 = originX
  const y0 = originY
  const x1 = originX + widthFt
  const y1 = originY + lengthFt
  return ensureOuterRingCCW([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ])
}

export function taggedWallsFromRect(
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): Array<{ side: WallSide; segment: WallSegment2 }> {
  const x0 = originX
  const y0 = originY
  const x1 = originX + widthFt
  const y1 = originY + lengthFt
  return [
    { side: 'top', segment: [[x0, y0], [x1, y0]] },
    { side: 'right', segment: [[x1, y0], [x1, y1]] },
    { side: 'bottom', segment: [[x1, y1], [x0, y1]] },
    { side: 'left', segment: [[x0, y1], [x0, y0]] },
  ]
}

export function wallsFromRect(
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): WallSegment2[] {
  return taggedWallsFromRect(originX, originY, widthFt, lengthFt).map((t) => t.segment)
}

export function structureFromRect(
  id: string,
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): ArchitecturalStructure {
  const tagged = taggedWallsFromRect(originX, originY, widthFt, lengthFt)
  return {
    id,
    walls: tagged.map((t) => t.segment),
    wallSides: tagged.map((t) => t.side),
    polygon: rectToRing(originX, originY, widthFt, lengthFt),
  }
}

function normalizeStructureWalls(
  structure: ArchitecturalStructure,
  epsilon: number
): NormalizedSeg[] {
  return structure.walls
    .map((w, i) => normalizeSegment(w, epsilon, structure.wallSides?.[i]))
    .filter((n): n is NormalizedSeg => n !== null)
}

function collectInternalBarriers(
  normsA: NormalizedSeg[],
  normsB: NormalizedSeg[],
  epsilon: number
): WallSegment2[] {
  const barriers: WallSegment2[] = []
  for (const sa of normsA) {
    for (const sb of normsB) {
      if (!segmentsAreInternalBarrier(sa, sb, epsilon)) continue
      const overlap = intervalOverlap(sa.lo, sa.hi, sb.lo, sb.hi, epsilon)
      if (!overlap) continue
      const [lo, hi] = overlap
      barriers.push([
        sa.axis === 'horizontal'
          ? [lo, sa.perp]
          : [sa.perp, lo],
        sa.axis === 'horizontal'
          ? [hi, sa.perp]
          : [sa.perp, hi],
      ])
      barriers.push([
        sb.axis === 'horizontal'
          ? [lo, sb.perp]
          : [sb.perp, lo],
        sb.axis === 'horizontal'
          ? [hi, sb.perp]
          : [sb.perp, hi],
      ])
    }
  }
  return barriers
}

function unionPolygons(polygons: Polygon[]): MultiPolygon {
  return guardedPolygonUnion(polygons.map((p) => normalizePolygonForUnion(p)))
}

function ringToPath(ring: Ring, interiorAnchor?: { x: number; y: number }): Vec2[] {
  const oriented = ensurePlacementOuterRing(ring, interiorAnchor)
  if (oriented.length === 0) return []
  const out: Vec2[] = oriented.map(([x, y]) => [x, y] as Vec2)
  const first = out[0]!
  const last = out[out.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push(first)
  }
  return out
}

/** Decompose an outer ring into axis-aligned wall segments for stroke paint. */
function pathToActiveWalls(path: ReadonlyArray<Vec2>, epsilon: number): WallSegment2[] {
  const walls: WallSegment2[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > epsilon) {
      walls.push([a, b])
    }
  }
  return walls
}

function summarizeUnion(mp: MultiPolygon): {
  paths: Vec2[][]
  aabb: { minX: number; minY: number; maxX: number; maxY: number }
  areaSqFt: number
} {
  const paths: Vec2[][] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let area = 0

  for (const polygon of mp) {
    const outer = polygon[0]
    if (!outer || outer.length < 4) continue
    paths.push(ringToPath(outer))
    area += Math.abs(signedRingArea(outer))
    for (const [px, py] of outer) {
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    }
  }

  if (!Number.isFinite(minX)) {
    return {
      paths: [],
      aabb: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      areaSqFt: 0,
    }
  }
  return { paths, aabb: { minX, minY, maxX, maxY }, areaSqFt: area }
}

/**
 * Boolean-union two structures and dissolve facing shared wall segments.
 */
export function mergeAdjacentStructures(
  roomA: ArchitecturalStructure,
  roomB: ArchitecturalStructure,
  epsilon = DEFAULT_MERGE_EPSILON_FT
): MergeAdjacentStructuresResult {
  const mp = unionPolygons([
    normalizePolygonForUnion([roomA.polygon]),
    normalizePolygonForUnion([roomB.polygon]),
  ])
  const { paths, aabb, areaSqFt } = summarizeUnion(mp)
  const internalBarriers = collectInternalBarriers(
    normalizeStructureWalls(roomA, epsilon),
    normalizeStructureWalls(roomB, epsilon),
    epsilon
  )
  const activeWalls = paths.flatMap((p) => pathToActiveWalls(p, epsilon))

  return {
    id: `${roomA.id}+${roomB.id}`,
    activeWalls,
    paths,
    internalBarriers,
    aabb,
    areaSqFt,
  }
}

/** Union many structures in one clip pass (join groups). */
export function mergeAdjacentStructuresMany(
  structures: ReadonlyArray<ArchitecturalStructure>,
  epsilon = DEFAULT_MERGE_EPSILON_FT
): MergeAdjacentStructuresResult | null {
  if (structures.length === 0) return null
  if (structures.length === 1) {
    const only = structures[0]!
    const paths = [ringToPath(only.polygon)]
    return {
      id: only.id,
      activeWalls: pathToActiveWalls(paths[0]!, epsilon),
      paths,
      internalBarriers: [],
      aabb: {
        minX: only.polygon[0]![0],
        minY: only.polygon[0]![1],
        maxX: only.polygon[2]![0],
        maxY: only.polygon[2]![1],
      },
      areaSqFt: Math.abs(signedRingArea(only.polygon)),
    }
  }

  const mp = unionPolygons(
    structures.map((s) => normalizePolygonForUnion([s.polygon]))
  )
  const { paths, aabb, areaSqFt } = summarizeUnion(mp)
  if (paths.length === 0) return null

  let internalBarriers: WallSegment2[] = []
  for (let i = 0; i < structures.length; i++) {
    for (let j = i + 1; j < structures.length; j++) {
      internalBarriers = internalBarriers.concat(
        collectInternalBarriers(
          normalizeStructureWalls(structures[i]!, epsilon),
          normalizeStructureWalls(structures[j]!, epsilon),
          epsilon
        )
      )
    }
  }

  return {
    id: structures.map((s) => s.id).join('+'),
    activeWalls: paths.flatMap((p) => pathToActiveWalls(p, epsilon)),
    paths,
    internalBarriers,
    aabb,
    areaSqFt,
  }
}

export function pathsToClosedRings(paths: ReadonlyArray<ReadonlyArray<Vec2>>): Vec2[][] {
  return paths.map((path) => {
    if (path.length === 0) return []
    const first = path[0]!
    const last = path[path.length - 1]!
    if (first[0] === last[0] && first[1] === last[1]) return [...path]
    return [...path, first]
  })
}
