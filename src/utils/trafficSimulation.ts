/**
 * Simulation-based foot traffic pathfinding for Popup Hub floor plans.
 *
 * Builds a walkable waypoint grid from room geometry and booth obstacles,
 * simulates patron drift between entrance, anchor fixtures, and exit, then
 * derives per-booth exposure scores and aisle heatmap cells for canvas overlays.
 */

import {
  astarGrid,
  buildNavigationGrid,
  type NavigationGrid,
  type PathPoint,
} from '@/components/coordinator/floor-plan-v2/engine/PathfindingService'
import {
  mergedZoneRingsForRoom,
  vendorBoothsInRoom,
} from '@/components/coordinator/floor-plan-v2/engine/BoothArrangementEngine'
import { evaluateTrafficFlowPrerequisites } from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import { rotatedAabb } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { PlacementRing } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TrafficWaypointNode {
  col: number
  row: number
  /** Cell center in canvas-global feet. */
  x: number
  y: number
}

export interface TrafficWaypointGrid extends NavigationGrid {
  /** Walkable cell centers keyed by `col,row`. */
  nodes: TrafficWaypointNode[]
  /** Cardinal (+ optional diagonal) adjacency lists keyed by `col,row`. */
  adjacency: ReadonlyMap<string, readonly string[]>
}

export interface BoothExposure {
  objectId: string
  passCount: number
  /** Normalized visibility score 0–100. */
  exposureScore: number
}

export interface TrafficHeatmapCell {
  x: number
  y: number
  sizeFt: number
  /** Visit density 0–1 (normalized across the grid). */
  intensity: number
}

export interface TrafficSimulationResult {
  grid: TrafficWaypointGrid
  boothExposure: BoothExposure[]
  boothExposureByObjectId: ReadonlyMap<string, number>
  heatmapCells: TrafficHeatmapCell[]
  /** Sampled patron trajectories for optional path overlay. */
  patronPaths: ReadonlyArray<ReadonlyArray<PathPoint>>
  visitGrid: number[][]
  patronCount: number
  anchorCount: number
}

export interface TrafficSimulationOptions {
  /** Grid resolution — feet per cell (default: doc.snapFt or 1). */
  cellFt?: number
  /** Extra clearance around impassable footprints (ft). */
  obstacleBufferFt?: number
  /** Number of simulated patrons (default 48). */
  patronCount?: number
  /** Visual sight radius for booth exposure (ft, default 8). */
  visualRadiusFt?: number
  /** Probability of taking a stochastic detour per path segment (0–1, default 0.12). */
  driftProbability?: number
  /** Include diagonal grid edges (default true). */
  allowDiagonals?: boolean
  /** Walkable boundary rings (defaults to merged_zone surface). */
  roomBoundary?: ReadonlyArray<PlacementRing>
  /** Vendor booths to score (defaults to vendor booths in room). */
  booths?: ReadonlyArray<BoothObject>
  /** Deterministic seed for reproducible drift (default layout hash). */
  seed?: number
  /** Patrons simulated per async yield batch (default 6). */
  batchSize?: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface GridCoord {
  col: number
  row: number
}

interface AnchorFixture {
  id: string
  kind: PlacedObject['kind']
  center: PathPoint
  weight: number
}

const CARDINAL: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
]

const DIAGONAL: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
]

const ANCHOR_KINDS = new Set<PlacedObject['kind']>(['stage', 'food_truck'])

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function parseKey(key: string): GridCoord {
  const [col, row] = key.split(',').map(Number)
  return { col: col!, row: row! }
}

function centerOf(obj: PlacedObject): PathPoint {
  const aabb = rotatedAabb(obj)
  return {
    x: aabb.x + aabb.width / 2,
    y: aabb.y + aabb.height / 2,
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

/** Mulberry32 — fast deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function hashDocSeed(doc: FloorPlanDoc, roomId: string): number {
  let h = 2166136261
  const s = `${roomId}:${doc.objects.length}:${doc.canvasWidthFt}:${doc.canvasLengthFt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (const obj of doc.objects) {
    h ^= obj.id.charCodeAt(0) ?? 0
    h = Math.imul(h, 16777619)
    h ^= Math.round(obj.x * 10) ^ Math.round(obj.y * 10)
  }
  return h >>> 0
}

function boothFrontNormal(rotationDeg: number): PathPoint {
  const rad = ((rotationDeg ?? 0) * Math.PI) / 180
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

function isWalkable(
  walkable: boolean[][],
  col: number,
  row: number,
  cols: number,
  rows: number
): boolean {
  return (
    row >= 0 &&
    col >= 0 &&
    row < rows &&
    col < cols &&
    Boolean(walkable[row]![col])
  )
}

// ---------------------------------------------------------------------------
// 1. Waypoint grid generation
// ---------------------------------------------------------------------------

/**
 * Invert the collision map: enumerate walkable aisle cells and build a
 * cardinal (+ optional diagonal) adjacency graph for pathfinding.
 */
export function buildTrafficWaypointGrid(
  doc: FloorPlanDoc,
  roomId: string,
  options: Pick<
    TrafficSimulationOptions,
    'cellFt' | 'obstacleBufferFt' | 'roomBoundary' | 'allowDiagonals'
  > = {}
): TrafficWaypointGrid | null {
  const allowDiagonals = options.allowDiagonals ?? true
  const roomBoundary =
    options.roomBoundary ?? mergedZoneRingsForRoom(doc, roomId)

  const nav = buildNavigationGrid(doc, roomId, {
    cellFt: options.cellFt,
    obstacleBufferFt: options.obstacleBufferFt ?? 1,
    roomBoundary,
  })
  if (!nav) return null

  const { walkable, cols, rows, originX, originY, cellFt } = nav
  const nodes: TrafficWaypointNode[] = []
  const adjacency = new Map<string, string[]>()

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!walkable[r]![c]) continue
      const key = cellKey(c, r)
      nodes.push({
        col: c,
        row: r,
        x: originX + (c + 0.5) * cellFt,
        y: originY + (r + 0.5) * cellFt,
      })

      const neighbors: string[] = []
      const deltas = allowDiagonals
        ? [...CARDINAL, ...DIAGONAL]
        : [...CARDINAL]

      for (const { dc, dr } of deltas) {
        const nc = c + dc
        const nr = r + dr
        if (!isWalkable(walkable, nc, nr, cols, rows)) continue
        if (allowDiagonals && Math.abs(dc) === 1 && Math.abs(dr) === 1) {
          if (
            !walkable[r]![nc] ||
            !walkable[nr]![c]
          ) {
            continue
          }
        }
        neighbors.push(cellKey(nc, nr))
      }
      adjacency.set(key, neighbors)
    }
  }

  return { ...nav, nodes, adjacency }
}

// ---------------------------------------------------------------------------
// 2. Ingress / egress / anchors
// ---------------------------------------------------------------------------

function resolveTerminals(
  doc: FloorPlanDoc,
  roomId: string
): { entrances: PathPoint[]; exits: PathPoint[]; anchors: AnchorFixture[] } {
  const prereq = evaluateTrafficFlowPrerequisites(doc, roomId)
  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)

  const entrances: PathPoint[] =
    prereq.entryDoors.length > 0
      ? prereq.entryDoors.map((d) => ({ x: d.centerX, y: d.centerY }))
      : inRoom
          .filter((o) => o.kind === 'door' && o.doorType === 'entrance')
          .map(centerOf)

  const exits: PathPoint[] =
    prereq.exitDoors.length > 0
      ? prereq.exitDoors.map((d) => ({ x: d.centerX, y: d.centerY }))
      : inRoom.filter((o) => o.kind === 'emergency_exit' || (o.kind === 'door' && o.doorType === 'exit')).map(centerOf)

  const anchors: AnchorFixture[] = []
  for (const obj of inRoom) {
    if (!ANCHOR_KINDS.has(obj.kind)) continue
    const weight = obj.kind === 'stage' ? 2.5 : 1.8
    anchors.push({
      id: obj.id,
      kind: obj.kind,
      center: centerOf(obj),
      weight,
    })
  }

  return { entrances, exits, anchors }
}

function pickWeighted<T extends { weight: number }>(
  items: T[],
  rng: () => number
): T | null {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.weight, 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]!
}

// ---------------------------------------------------------------------------
// Pathfinding with stochastic drift
// ---------------------------------------------------------------------------

function astarWithDrift(
  walkable: boolean[][],
  start: GridCoord,
  goal: GridCoord,
  cols: number,
  rows: number,
  rng: () => number,
  driftProbability: number,
  boothDensity: Float32Array,
  colsCount: number
): GridCoord[] | null {
  const base = astarGrid(walkable, start, goal, cols, rows)
  if (!base || base.length < 2) return base

  if (rng() >= driftProbability) return base

  const detourLen = 1 + Math.floor(rng() * 3)
  const insertAt = 1 + Math.floor(rng() * Math.max(1, base.length - 2))
  const origin = base[insertAt - 1]!
  const neighbors = CARDINAL
    .map(({ dc, dr }) => ({ col: origin.col + dc, row: origin.row + dr }))
    .filter((n) => isWalkable(walkable, n.col, n.row, cols, rows))

  if (neighbors.length === 0) return base

  const loop: GridCoord[] = []
  let cursor = neighbors[Math.floor(rng() * neighbors.length)]!
  loop.push(cursor)

  for (let step = 0; step < detourLen; step++) {
    const options = CARDINAL.map(({ dc, dr }) => ({
      col: cursor.col + dc,
      row: cursor.row + dr,
    })).filter((n) => isWalkable(walkable, n.col, n.row, cols, rows))

    if (options.length === 0) break

    options.sort((a, b) => {
      const da = boothDensity[a.row * colsCount + a.col] ?? 0
      const db = boothDensity[b.row * colsCount + b.col] ?? 0
      return db - da + (rng() - 0.5) * 0.15
    })
    cursor = options[0]!
    loop.push(cursor)
  }

  const rejoin = astarGrid(walkable, cursor, goal, cols, rows)
  if (!rejoin) return base

  const merged = [
    ...base.slice(0, insertAt),
    ...loop,
    ...rejoin.slice(1),
  ]
  return merged
}

function buildBoothDensityField(
  grid: TrafficWaypointGrid,
  booths: ReadonlyArray<BoothObject>
): Float32Array {
  const { cols, rows, originX, originY, cellFt } = grid
  const field = new Float32Array(cols * rows)
  const radius = cellFt * 2.5

  for (const booth of booths) {
    const aabb = rotatedAabb(booth)
    const cx = aabb.x + aabb.width / 2
    const cy = aabb.y + aabb.height / 2
    const g = ftToGrid({ x: cx, y: cy }, originX, originY, cellFt)
    const minC = Math.max(0, g.col - 3)
    const maxC = Math.min(cols - 1, g.col + 3)
    const minR = Math.max(0, g.row - 3)
    const maxR = Math.min(rows - 1, g.row + 3)

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!grid.walkable[r]![c]) continue
        const px = originX + (c + 0.5) * cellFt
        const py = originY + (r + 0.5) * cellFt
        const d = Math.hypot(px - cx, py - cy)
        if (d <= radius) {
          field[r * cols + c] = (field[r * cols + c] ?? 0) + 1 - d / radius
        }
      }
    }
  }
  return field
}

// ---------------------------------------------------------------------------
// 3. Booth visibility & exposure scoring
// ---------------------------------------------------------------------------

function boothVisibleFromNode(
  node: PathPoint,
  booth: BoothObject,
  visualRadiusFt: number
): boolean {
  const aabb = rotatedAabb(booth)
  const bx = aabb.x + aabb.width / 2
  const by = aabb.y + aabb.height / 2
  const dx = node.x - bx
  const dy = node.y - by
  const dist = Math.hypot(dx, dy)
  if (dist > visualRadiusFt || dist < 0.25) return false

  const front = boothFrontNormal(booth.rotation ?? 0)
  const nx = dx / dist
  const ny = dy / dist
  const facing = front.x * nx + front.y * ny
  return facing > 0.25
}

function normalizeExposureScores(
  counts: Map<string, number>
): BoothExposure[] {
  let max = 0
  for (const v of counts.values()) {
    if (v > max) max = v
  }
  const out: BoothExposure[] = []
  for (const [objectId, passCount] of counts) {
    const exposureScore =
      max <= 0 ? 0 : Math.round((passCount / max) * 100)
    out.push({ objectId, passCount, exposureScore })
  }
  out.sort((a, b) => b.exposureScore - a.exposureScore)
  return out
}

function buildHeatmapCells(
  grid: TrafficWaypointGrid,
  visitGrid: number[][]
): TrafficHeatmapCell[] {
  const { originX, originY, cellFt, cols, rows } = grid
  let maxVisits = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = visitGrid[r]![c] ?? 0
      if (v > maxVisits) maxVisits = v
    }
  }
  if (maxVisits <= 0) return []

  const cells: TrafficHeatmapCell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const visits = visitGrid[r]![c] ?? 0
      if (visits <= 0 || !grid.walkable[r]![c]) continue
      cells.push({
        x: originX + c * cellFt,
        y: originY + r * cellFt,
        sizeFt: cellFt,
        intensity: visits / maxVisits,
      })
    }
  }
  return cells
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

export interface TrafficSimulationProgress {
  completedPatrons: number
  totalPatrons: number
}

function simulatePatronBatch(
  grid: TrafficWaypointGrid,
  booths: ReadonlyArray<BoothObject>,
  terminals: ReturnType<typeof resolveTerminals>,
  options: Required<
    Pick<
      TrafficSimulationOptions,
      | 'patronCount'
      | 'visualRadiusFt'
      | 'driftProbability'
      | 'seed'
    >
  >,
  startIndex: number,
  endIndex: number,
  visitGrid: number[][],
  exposureCounts: Map<string, number>,
  patronPaths: PathPoint[][]
): void {
  const { walkable, cols, rows, originX, originY, cellFt } = grid
  const rng = mulberry32(options.seed + startIndex * 9973)
  const boothDensity = buildBoothDensityField(grid, booths)

  const fallbackCentroid =
    grid.nodes[Math.floor(grid.nodes.length / 2)] ??
    ({ x: originX, y: originY } as PathPoint)

  for (let p = startIndex; p < endIndex; p++) {
    const entrance =
      terminals.entrances.length > 0
        ? terminals.entrances[Math.floor(rng() * terminals.entrances.length)]!
        : fallbackCentroid
    const exit =
      terminals.exits.length > 0
        ? terminals.exits[Math.floor(rng() * terminals.exits.length)]!
        : fallbackCentroid

    const anchorStops: PathPoint[] = []
    const anchorVisitCount =
      terminals.anchors.length > 0
        ? 1 + Math.floor(rng() * Math.min(3, terminals.anchors.length))
        : 0
    const anchorPool = [...terminals.anchors]
    for (let a = 0; a < anchorVisitCount && anchorPool.length > 0; a++) {
      const picked = pickWeighted(anchorPool, rng)
      if (!picked) break
      anchorStops.push(picked.center)
      const idx = anchorPool.findIndex((x) => x.id === picked.id)
      if (idx >= 0) anchorPool.splice(idx, 1)
    }

    const waypoints: PathPoint[] = [entrance, ...anchorStops, exit]
    const pathCells: GridCoord[] = []

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = ftToGrid(waypoints[i]!, originX, originY, cellFt)
      const b = ftToGrid(waypoints[i + 1]!, originX, originY, cellFt)
      const segment = astarWithDrift(
        walkable,
        a,
        b,
        cols,
        rows,
        rng,
        options.driftProbability,
        boothDensity,
        cols
      )
      if (!segment) continue
      for (const cell of segment) {
        const last = pathCells[pathCells.length - 1]
        if (last && last.col === cell.col && last.row === cell.row) continue
        pathCells.push(cell)
      }
    }

    if (pathCells.length === 0) continue

    const pathFt = pathCells.map((g) =>
      gridToFt(g, originX, originY, cellFt)
    )
    if (p < 8) patronPaths.push(pathFt)

    for (const cell of pathCells) {
      visitGrid[cell.row]![cell.col] =
        (visitGrid[cell.row]![cell.col] ?? 0) + 1

      const node = gridToFt(cell, originX, originY, cellFt)
      const density = boothDensity[cell.row * cols + cell.col] ?? 0
      const linger = density > 0.6 ? 1 : 0

      for (let lingerPass = 0; lingerPass <= linger; lingerPass++) {
        for (const booth of booths) {
          if (!boothVisibleFromNode(node, booth, options.visualRadiusFt)) {
            continue
          }
          exposureCounts.set(
            booth.id,
            (exposureCounts.get(booth.id) ?? 0) + 1
          )
        }
      }
    }
  }
}

/**
 * Run the full traffic simulation synchronously.
 * Prefer {@link runTrafficSimulationAsync} in UI contexts.
 */
export function runTrafficSimulation(
  doc: FloorPlanDoc,
  roomId: string,
  options: TrafficSimulationOptions = {}
): TrafficSimulationResult | null {
  const cellFt = options.cellFt ?? doc.snapFt ?? 1
  const patronCount = options.patronCount ?? 48
  const visualRadiusFt = options.visualRadiusFt ?? 8
  const driftProbability = options.driftProbability ?? 0.12
  const seed = options.seed ?? hashDocSeed(doc, roomId)

  const grid = buildTrafficWaypointGrid(doc, roomId, {
    cellFt,
    obstacleBufferFt: options.obstacleBufferFt,
    roomBoundary: options.roomBoundary,
    allowDiagonals: options.allowDiagonals,
  })
  if (!grid || grid.nodes.length === 0) return null

  const booths = (
    options.booths ?? vendorBoothsInRoom(doc, roomId)
  ).filter((b) => b.x > -500)

  const terminals = resolveTerminals(doc, roomId)
  const visitGrid: number[][] = Array.from({ length: grid.rows }, () =>
    Array.from({ length: grid.cols }, () => 0)
  )
  const exposureCounts = new Map<string, number>()
  for (const booth of booths) exposureCounts.set(booth.id, 0)

  const patronPaths: PathPoint[][] = []
  simulatePatronBatch(
    grid,
    booths,
    terminals,
    { patronCount, visualRadiusFt, driftProbability, seed },
    0,
    patronCount,
    visitGrid,
    exposureCounts,
    patronPaths
  )

  const boothExposure = normalizeExposureScores(exposureCounts)
  const boothExposureByObjectId = new Map<string, number>(
    boothExposure.map((b) => [b.objectId, b.exposureScore])
  )

  return {
    grid,
    boothExposure,
    boothExposureByObjectId,
    heatmapCells: buildHeatmapCells(grid, visitGrid),
    patronPaths,
    visitGrid,
    patronCount,
    anchorCount: terminals.anchors.length,
  }
}

/**
 * Run the simulation in batches, yielding to the event loop between batches
 * so floor-plan edits stay responsive.
 */
export async function runTrafficSimulationAsync(
  doc: FloorPlanDoc,
  roomId: string,
  options: TrafficSimulationOptions = {},
  onProgress?: (progress: TrafficSimulationProgress) => void
): Promise<TrafficSimulationResult | null> {
  const cellFt = options.cellFt ?? doc.snapFt ?? 1
  const patronCount = options.patronCount ?? 48
  const visualRadiusFt = options.visualRadiusFt ?? 8
  const driftProbability = options.driftProbability ?? 0.12
  const seed = options.seed ?? hashDocSeed(doc, roomId)
  const batchSize = options.batchSize ?? 6

  const grid = buildTrafficWaypointGrid(doc, roomId, {
    cellFt,
    obstacleBufferFt: options.obstacleBufferFt,
    roomBoundary: options.roomBoundary,
    allowDiagonals: options.allowDiagonals,
  })
  if (!grid || grid.nodes.length === 0) return null

  const booths = (
    options.booths ?? vendorBoothsInRoom(doc, roomId)
  ).filter((b) => b.x > -500)

  const terminals = resolveTerminals(doc, roomId)
  const visitGrid: number[][] = Array.from({ length: grid.rows }, () =>
    Array.from({ length: grid.cols }, () => 0)
  )
  const exposureCounts = new Map<string, number>()
  for (const booth of booths) exposureCounts.set(booth.id, 0)

  const patronPaths: PathPoint[][] = []
  const simOptions = { patronCount, visualRadiusFt, driftProbability, seed }

  for (let start = 0; start < patronCount; start += batchSize) {
    const end = Math.min(patronCount, start + batchSize)
    simulatePatronBatch(
      grid,
      booths,
      terminals,
      simOptions,
      start,
      end,
      visitGrid,
      exposureCounts,
      patronPaths
    )
    onProgress?.({ completedPatrons: end, totalPatrons: patronCount })
    await new Promise<void>((resolve) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(), { timeout: 32 })
      } else {
        setTimeout(resolve, 0)
      }
    })
  }

  const boothExposure = normalizeExposureScores(exposureCounts)
  const boothExposureByObjectId = new Map<string, number>(
    boothExposure.map((b) => [b.objectId, b.exposureScore])
  )

  return {
    grid,
    boothExposure,
    boothExposureByObjectId,
    heatmapCells: buildHeatmapCells(grid, visitGrid),
    patronPaths,
    visitGrid,
    patronCount,
    anchorCount: terminals.anchors.length,
  }
}
