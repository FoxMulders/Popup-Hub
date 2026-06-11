/**
 * Unified layout solver — coupled booth + patron-spine optimization.
 *
 * Phases:
 *   1. Skeleton init — room bounds, serpentine spine, traffic no-fly rects.
 *   2. Slot seed — patron-centric corridor slots as starting positions.
 *   3. Coupled force loop — clearance bands, category density, spine exposure.
 *   4. Hard projection — clamp to room, resolve overlaps, enforce no-fly.
 *
 * Clearance bands align with `lib/coordinator/booth-clearance-visual.ts`:
 *   ≥4′ good · ≥3′ tight · <3′ critical.
 */

import {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
  clearanceBand,
  edgeClearanceBetweenRects,
} from '@/lib/coordinator/booth-clearance-visual'
import {
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
} from '../interactions/category-rules'
import { rotatedAabb, type Rect } from '../interactions/geometry'
import {
  buildPatronPathway,
  calculatePatronCentricLayout,
  PATRON_CORRIDOR_WIDTH_FT,
  type PatronLayoutPoint,
} from './patron-centric-layout'
import {
  buildTrafficNoFlyRects,
  packBoothsForRoom,
  packBoothsTrafficAware,
  restrictedObstaclesInRoom,
  ringToRoomPolygon,
  type BoothPackInput,
  type BoothPackObstacle,
  type BoothPlacement,
  type PackBoothsOptions,
  type PackBoothsResult,
} from './AutoArrangeEngine'
import { booleanWithin, polygon } from '@turf/turf'
import type { FloorPlanDoc } from '../state/types'
import { resolveRoomPlacementSurface } from '../state/placement-surface'
import { evaluateTrafficFlowPrerequisites } from './traffic-flow-prerequisites'

import { VENDOR_BOOTH_AISLE_FT } from '@/lib/booth-planner/layout-clearance-constants'

/** Target edge-to-edge aisle between vendor booths (ft). */
export const UNIFIED_IDEAL_CLEARANCE_FT = BOOTH_CLEARANCE_GOOD_FT

/** Seed-phase aisle — matches traffic-aware pack so slots exist before 4′ lift. */
const UNIFIED_SEED_CLEARANCE_FT = VENDOR_BOOTH_AISLE_FT

export interface UnifiedSolverOptions {
  obstacles?: ReadonlyArray<BoothPackObstacle>
  entrance?: PatronLayoutPoint
  exit?: PatronLayoutPoint
  eventCategoryNames?: ReadonlyArray<string>
  /** Booth id → category label for proximity kernel. */
  categoryByBoothId?: ReadonlyMap<string, string>
  idealClearanceFt?: number
  gridSpacingFt?: number
  maxIterations?: number
  corridorWidthFt?: number
}

export interface ClearanceHeatCell {
  x: number
  y: number
  sizeFt: number
  clearanceFt: number
  band: 'critical' | 'tight' | 'good'
}

export interface UnifiedSolverMeta {
  pathway: PatronLayoutPoint[]
  flowTerminals: { entrance: PatronLayoutPoint; exit: PatronLayoutPoint }
  clearanceField: ClearanceHeatCell[]
  iterations: number
  finalEnergy: number
  exposureShifts: number
}

export interface UnifiedSolverResult {
  placed: BoothPlacement[]
  unplaced: string[]
  meta: UnifiedSolverMeta
}

interface SolverNode {
  id: string
  width: number
  height: number
  x: number
  y: number
  rotation: number
  category: string | null
}

const WALL_INSET_FT = 3.5
const DEFAULT_MAX_ITER = 48
const HEAT_CELL_FT = 4

function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function nodeAabb(node: SolverNode): Rect {
  return rotatedAabb({
    id: node.id,
    kind: 'booth',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    accentColor: null,
  })
}

function resolveTerminals(
  roomW: number,
  roomH: number,
  options: UnifiedSolverOptions
): { entrance: PatronLayoutPoint; exit: PatronLayoutPoint } {
  if (options.entrance && options.exit) {
    return { entrance: options.entrance, exit: options.exit }
  }
  return {
    entrance: options.entrance ?? {
      x: roomW / 2,
      y: roomH - WALL_INSET_FT - 1,
    },
    exit: options.exit ?? { x: roomW / 2, y: WALL_INSET_FT + 1 },
  }
}

function obstaclesToRects(
  obstacles: ReadonlyArray<BoothPackObstacle> | undefined
): Rect[] {
  return (obstacles ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }))
}

function minClearanceToObstacles(aabb: Rect, obstacles: Rect[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const obs of obstacles) {
    const gap = edgeClearanceBetweenRects(aabb, obs)
    if (gap < min) min = gap
  }
  return min
}

function violatesCategoryProximity(
  a: SolverNode,
  b: SolverNode,
  gridSpacingFt: number
): boolean {
  if (!a.category || !b.category || a.category !== b.category) return false
  const acx = a.x + a.width / 2
  const acy = a.y + a.height / 2
  const bcx = b.x + b.width / 2
  const bcy = b.y + b.height / 2
  const dxColumns = Math.abs(acx - bcx) / gridSpacingFt
  const dyRows = Math.abs(acy - bcy) / gridSpacingFt
  return dxColumns < PROXIMITY_MIN_COLUMNS && dyRows < PROXIMITY_MIN_ROWS
}

function distToPathway(
  px: number,
  py: number,
  pathway: ReadonlyArray<PatronLayoutPoint>
): number {
  let best = Infinity
  for (let i = 0; i < pathway.length - 1; i++) {
    const a = pathway[i]!
    const b = pathway[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < 1e-9) {
      best = Math.min(best, Math.hypot(px - a.x, py - a.y))
      continue
    }
    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const cx = a.x + t * dx
    const cy = a.y + t * dy
    best = Math.min(best, Math.hypot(px - cx, py - cy))
  }
  return best
}

function computeEnergy(
  nodes: SolverNode[],
  idealFt: number,
  pathway: ReadonlyArray<PatronLayoutPoint>,
  gridSpacingFt: number
): number {
  let energy = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!
      const b = nodes[j]!
      const gap = edgeClearanceBetweenRects(nodeAabb(a), nodeAabb(b))
      if (gap < idealFt) {
        const severity =
          gap <= BOOTH_CLEARANCE_CRITICAL_FT
            ? 4
            : gap <= BOOTH_CLEARANCE_TIGHT_FT
              ? 2
              : 1
        energy += severity * (idealFt - gap) ** 2
      }
      if (violatesCategoryProximity(a, b, gridSpacingFt)) {
        energy += 8
      }
    }
    const node = nodes[i]!
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    const pathDist = distToPathway(cx, cy, pathway)
    energy += pathDist * 0.05
  }
  return energy
}

function applyClearanceForces(
  nodes: SolverNode[],
  idealFt: number,
  gridSpacingFt: number,
  stepScale: number
): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!
      const b = nodes[j]!
      const aabbA = nodeAabb(a)
      const aabbB = nodeAabb(b)
      const gap = edgeClearanceBetweenRects(aabbA, aabbB)

      const acx = a.x + a.width / 2
      const acy = a.y + a.height / 2
      const bcx = b.x + b.width / 2
      const bcy = b.y + b.height / 2
      let fx = acx - bcx
      let fy = acy - bcy
      const dist = Math.hypot(fx, fy) || 1
      fx /= dist
      fy /= dist

      if (gap < idealFt) {
        const push =
          stepScale *
          (gap <= BOOTH_CLEARANCE_CRITICAL_FT
            ? 1.2
            : gap <= BOOTH_CLEARANCE_TIGHT_FT
              ? 0.7
              : 0.35) *
          (idealFt - gap)
        a.x += fx * push * 0.5
        a.y += fy * push * 0.5
        b.x -= fx * push * 0.5
        b.y -= fy * push * 0.5
      }

      if (violatesCategoryProximity(a, b, gridSpacingFt)) {
        const catPush = stepScale * 0.6
        a.x += fx * catPush * 0.5
        a.y += fy * catPush * 0.5
        b.x -= fx * catPush * 0.5
        b.y -= fy * catPush * 0.5
      }
    }
  }
}

function applySpineExposureForces(
  nodes: SolverNode[],
  pathway: ReadonlyArray<PatronLayoutPoint>,
  stepScale: number
): void {
  for (const node of nodes) {
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    let bestDist = Infinity
    let targetX = cx
    let targetY = cy
    for (let i = 0; i < pathway.length - 1; i++) {
      const a = pathway[i]!
      const b = pathway[i + 1]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const lenSq = dx * dx + dy * dy
      if (lenSq < 1e-9) continue
      let t = ((cx - a.x) * dx + (cy - a.y) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
      const px = a.x + t * dx
      const py = a.y + t * dy
      const d = Math.hypot(cx - px, cy - py)
      if (d < bestDist) {
        bestDist = d
        const offset = node.height * 0.5 + PATRON_CORRIDOR_WIDTH_FT / 2 + 2
        const segLen = Math.sqrt(lenSq) || 1
        const nx = -dy / segLen
        const ny = dx / segLen
        const side = cx * nx + cy * ny > px * nx + py * ny ? 1 : -1
        targetX = px + nx * offset * side
        targetY = py + ny * offset * side
      }
    }
    node.x += (targetX - node.width / 2 - node.x) * stepScale * 0.08
    node.y += (targetY - node.height / 2 - node.y) * stepScale * 0.08
  }
}

function hardProjectNode(
  node: SolverNode,
  roomW: number,
  roomH: number,
  noFlyRects: Rect[],
  structuralRects: Rect[],
  otherNodes: SolverNode[],
  idealFt: number
): void {
  const half = idealFt * 0.5
  const aabb = nodeAabb(node)
  if (aabb.x < WALL_INSET_FT) node.x += WALL_INSET_FT - aabb.x
  if (aabb.y < WALL_INSET_FT) node.y += WALL_INSET_FT - aabb.y
  const aabb2 = nodeAabb(node)
  if (aabb2.x + aabb2.width > roomW - WALL_INSET_FT) {
    node.x -= aabb2.x + aabb2.width - (roomW - WALL_INSET_FT)
  }
  if (aabb2.y + aabb2.height > roomH - WALL_INSET_FT) {
    node.y -= aabb2.y + aabb2.height - (roomH - WALL_INSET_FT)
  }

  for (const obs of [...structuralRects, ...noFlyRects]) {
    const padded = expandRect(obs, half)
    const nAabb = nodeAabb(node)
    if (!aabbOverlap(nAabb, padded)) continue
    const ncx = node.x + node.width / 2
    const ncy = node.y + node.height / 2
    const ocx = obs.x + obs.width / 2
    const ocy = obs.y + obs.height / 2
    let fx = ncx - ocx
    let fy = ncy - ocy
    const d = Math.hypot(fx, fy) || 1
    fx /= d
    fy /= d
    node.x += fx * 0.75
    node.y += fy * 0.75
  }

  for (const other of otherNodes) {
    if (other.id === node.id) continue
    const gap = edgeClearanceBetweenRects(nodeAabb(node), nodeAabb(other))
    if (gap >= idealFt) continue
    const ncx = node.x + node.width / 2
    const ncy = node.y + node.height / 2
    const ocx = other.x + other.width / 2
    const ocy = other.y + other.height / 2
    let fx = ncx - ocx
    let fy = ncy - ocy
    const d = Math.hypot(fx, fy) || 1
    fx /= d
    fy /= d
    const push = (idealFt - gap) * 0.55
    node.x += fx * push
    node.y += fy * push
  }
}

function buildClearanceHeatField(
  roomW: number,
  roomH: number,
  nodes: SolverNode[],
  structuralRects: Rect[]
): ClearanceHeatCell[] {
  const cells: ClearanceHeatCell[] = []
  for (let y = WALL_INSET_FT; y < roomH - WALL_INSET_FT; y += HEAT_CELL_FT) {
    for (let x = WALL_INSET_FT; x < roomW - WALL_INSET_FT; x += HEAT_CELL_FT) {
      const probe: Rect = { x, y, width: HEAT_CELL_FT, height: HEAT_CELL_FT }
      let minGap = Number.POSITIVE_INFINITY
      for (const node of nodes) {
        const gap = edgeClearanceBetweenRects(probe, nodeAabb(node))
        if (gap < minGap) minGap = gap
      }
      for (const obs of structuralRects) {
        const gap = edgeClearanceBetweenRects(probe, obs)
        if (gap < minGap) minGap = gap
      }
      const clearanceFt = Number.isFinite(minGap) ? minGap : BOOTH_CLEARANCE_GOOD_FT
      cells.push({
        x,
        y,
        sizeFt: HEAT_CELL_FT,
        clearanceFt,
        band: clearanceBand(clearanceFt),
      })
    }
  }
  return cells
}

function nodeInsideRoom(
  node: SolverNode,
  roomW: number,
  roomH: number
): boolean {
  const aabb = nodeAabb(node)
  return (
    aabb.x >= WALL_INSET_FT - 1 &&
    aabb.y >= WALL_INSET_FT - 1 &&
    aabb.x + aabb.width <= roomW - WALL_INSET_FT + 1 &&
    aabb.y + aabb.height <= roomH - WALL_INSET_FT + 1
  )
}

function enforceMinimumClearance(
  nodes: SolverNode[],
  idealFt: number,
  roomW: number,
  roomH: number,
  structuralRects: Rect[],
  noFlyRects: Rect[],
  maxPasses = 16
): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const gap = edgeClearanceBetweenRects(nodeAabb(a), nodeAabb(b))
        if (gap >= idealFt) continue
        const acx = a.x + a.width / 2
        const acy = a.y + a.height / 2
        const bcx = b.x + b.width / 2
        const bcy = b.y + b.height / 2
        let fx = acx - bcx
        let fy = acy - bcy
        const dist = Math.hypot(fx, fy) || 1
        fx /= dist
        fy /= dist
        const push = ((idealFt - gap) * 0.55) / 2
        a.x += fx * push
        a.y += fy * push
        b.x -= fx * push
        b.y -= fy * push
        moved = true
      }
    }
    for (const node of nodes) {
      hardProjectNode(
        node,
        roomW,
        roomH,
        noFlyRects,
        structuralRects,
        nodes,
        idealFt
      )
    }
    if (!moved) break
  }
}

/**
 * Run the unified booth + spine solver inside a room-local footprint.
 */
export function runUnifiedLayoutSolver(
  roomWidthFt: number,
  roomHeightFt: number,
  boothList: ReadonlyArray<BoothPackInput>,
  options: UnifiedSolverOptions = {}
): UnifiedSolverResult {
  const idealFt = options.idealClearanceFt ?? UNIFIED_IDEAL_CLEARANCE_FT
  const gridSpacingFt = options.gridSpacingFt ?? 1
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITER
  const corridorWidthFt = options.corridorWidthFt ?? PATRON_CORRIDOR_WIDTH_FT

  if (boothList.length === 0) {
    return {
      placed: [],
      unplaced: [],
      meta: {
        pathway: [],
        flowTerminals: {
          entrance: { x: roomWidthFt / 2, y: roomHeightFt - 1 },
          exit: { x: roomWidthFt / 2, y: 1 },
        },
        clearanceField: [],
        iterations: 0,
        finalEnergy: 0,
        exposureShifts: 0,
      },
    }
  }

  const { entrance, exit } = resolveTerminals(
    roomWidthFt,
    roomHeightFt,
    options
  )
  const maxDepth = Math.max(...boothList.map((b) => b.height), 6)
  const pathway = buildPatronPathway(
    roomWidthFt,
    roomHeightFt,
    entrance,
    exit,
    corridorWidthFt,
    maxDepth
  )
  const noFlyRects = buildTrafficNoFlyRects(pathway, corridorWidthFt)
  const structuralRects = obstaclesToRects(options.obstacles)

  const categoryById =
    options.categoryByBoothId ?? new Map<string, string>()

  let seedLayout = calculatePatronCentricLayout(
    roomWidthFt,
    roomHeightFt,
    boothList.map((b) => ({
      id: b.id,
      width: b.width,
      height: b.height,
      kind: 'booth' as const,
      categoryName: categoryById.get(b.id) ?? null,
    })),
    {
      entrance,
      exit,
      obstacles: [...structuralRects, ...noFlyRects],
      corridorWidthFt,
      edgeClearanceFt: UNIFIED_SEED_CLEARANCE_FT,
      gridSpacingFt,
      eventCategoryNames: options.eventCategoryNames,
      layoutStyle: 'chevron-45',
    }
  )

  if (seedLayout.placed.length === 0) {
    const trafficSeed = packBoothsTrafficAware(roomWidthFt, roomHeightFt, boothList, {
      entrance,
      exit,
      obstacles: options.obstacles,
      aisleWidth: UNIFIED_SEED_CLEARANCE_FT,
      stepFt: gridSpacingFt,
      eventCategoryNames: options.eventCategoryNames,
    })
    seedLayout = {
      ...seedLayout,
      placed: trafficSeed.placed.map((p) => {
        const booth = boothList.find((b) => b.id === p.id)!
        return {
          id: p.id,
          width: booth.width,
          height: booth.height,
          kind: 'booth' as const,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          categoryName: categoryById.get(p.id) ?? null,
        }
      }),
      pathway: trafficSeed.meta?.pathway ?? pathway,
    }
  }

  const seedNodes: SolverNode[] = seedLayout.placed.map((p) => ({
    id: p.id,
    width: p.width,
    height: p.height,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    category: p.categoryName ?? categoryById.get(p.id) ?? null,
  }))

  const seedById = new Map(seedNodes.map((n) => [n.id, { ...n }]))

  const nodes: SolverNode[] = seedNodes.map((n) => ({ ...n }))

  const droppedIds = new Set(seedLayout.dropped.map((d) => d.id))
  let finalEnergy = computeEnergy(nodes, idealFt, pathway, gridSpacingFt)

  if (nodes.length > 0) {
    for (let iter = 0; iter < maxIterations; iter++) {
      const stepScale = 1 - iter / (maxIterations * 1.15)
      applyClearanceForces(nodes, idealFt, gridSpacingFt, stepScale)
      applySpineExposureForces(nodes, pathway, stepScale)
      for (const node of nodes) {
        hardProjectNode(
          node,
          roomWidthFt,
          roomHeightFt,
          noFlyRects,
          structuralRects,
          nodes,
          idealFt
        )
      }
      const energy = computeEnergy(nodes, idealFt, pathway, gridSpacingFt)
      if (energy >= finalEnergy - 1e-4 && iter > 8) break
      finalEnergy = energy
    }
    enforceMinimumClearance(
      nodes,
      idealFt,
      roomWidthFt,
      roomHeightFt,
      structuralRects,
      noFlyRects
    )
  }

  const placed: BoothPlacement[] = []
  for (const node of nodes.length > 0 ? nodes : seedNodes) {
    let candidate = node
    if (!nodeInsideRoom(candidate, roomWidthFt, roomHeightFt)) {
      const seed = seedById.get(node.id)
      if (seed && nodeInsideRoom(seed, roomWidthFt, roomHeightFt)) {
        candidate = seed
      } else {
        droppedIds.add(node.id)
        continue
      }
    }
    placed.push({
      id: candidate.id,
      x: candidate.x,
      y: candidate.y,
      rotation: candidate.rotation,
    })
  }

  const placedIds = new Set(placed.map((p) => p.id))
  const unplaced = [
    ...droppedIds,
    ...boothList.filter((b) => !placedIds.has(b.id)).map((b) => b.id),
  ]

  return {
    placed,
    unplaced: [...new Set(unplaced)],
    meta: {
      pathway,
      flowTerminals: { entrance, exit },
      clearanceField: buildClearanceHeatField(
        roomWidthFt,
        roomHeightFt,
        nodes.length > 0 ? nodes : seedNodes,
        structuralRects
      ),
      iterations: maxIterations,
      finalEnergy,
      exposureShifts: 0,
    },
  }
}

/** Minimum edge clearance between any two placed booths (ft). */
export function minPairwiseClearanceFt(
  placed: ReadonlyArray<BoothPlacement>,
  booths: ReadonlyArray<BoothPackInput>
): number {
  const byId = new Map(booths.map((b) => [b.id, b]))
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!
      const b = placed[j]!
      const ba = byId.get(a.id)
      const bb = byId.get(b.id)
      if (!ba || !bb) continue
      const gap = edgeClearanceBetweenRects(
        rotatedAabb({
          ...a,
          kind: 'booth',
          width: ba.width,
          height: ba.height,
          accentColor: null,
        }),
        rotatedAabb({
          ...b,
          kind: 'booth',
          width: bb.width,
          height: bb.height,
          accentColor: null,
        })
      )
      if (gap < min) min = gap
    }
  }
  return min
}

/** Count booth pairs at or below the critical clearance band (≤2′). */
export function countCriticalClearanceViolations(
  placed: ReadonlyArray<BoothPlacement>,
  booths: ReadonlyArray<BoothPackInput>
): number {
  const byId = new Map(booths.map((b) => [b.id, b]))
  let count = 0
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!
      const b = placed[j]!
      const ba = byId.get(a.id)
      const bb = byId.get(b.id)
      if (!ba || !bb) continue
      const gap = edgeClearanceBetweenRects(
        rotatedAabb({
          ...a,
          kind: 'booth',
          width: ba.width,
          height: ba.height,
          accentColor: null,
        }),
        rotatedAabb({
          ...b,
          kind: 'booth',
          width: bb.width,
          height: bb.height,
          accentColor: null,
        })
      )
      if (gap <= BOOTH_CLEARANCE_CRITICAL_FT) count++
    }
  }
  return count
}

export type UnifiedPackOptions = Omit<PackBoothsOptions, 'obstacles'> & {
  eventCategoryNames?: ReadonlyArray<string>
}

export interface UnifiedPackResult extends PackBoothsResult {
  unifiedMeta?: UnifiedSolverMeta
}

/**
 * Pack booths via unified solver for a doc room — same contract as
 * {@link packBoothsForRoom} with extended meta for patron-flow overlay.
 */
export function packBoothsUnifiedForRoom(
  doc: FloorPlanDoc,
  roomId: string,
  booths: ReadonlyArray<BoothPackInput>,
  options: UnifiedPackOptions = {}
): UnifiedPackResult {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface || booths.length === 0) {
    return { placed: [], unplaced: booths.map((b) => b.id) }
  }

  const roomW = Math.max(1, surface.maxX - surface.minX)
  const roomH = Math.max(1, surface.maxY - surface.minY)
  const obstacles = restrictedObstaclesInRoom(doc, roomId)
  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const entranceLocal = traffic.entryDoors[0]
    ? { x: traffic.entryDoors[0].centerX, y: traffic.entryDoors[0].centerY }
    : undefined
  const exitLocal = traffic.exitDoors[0]
    ? { x: traffic.exitDoors[0].centerX, y: traffic.exitDoors[0].centerY }
    : undefined

  const localObstacles = obstacles.map((o) => ({
    ...o,
    x: o.x - surface.minX,
    y: o.y - surface.minY,
  }))

  const unified = runUnifiedLayoutSolver(roomW, roomH, booths, {
    obstacles: localObstacles,
    entrance: entranceLocal,
    exit: exitLocal,
    eventCategoryNames: options.eventCategoryNames,
    gridSpacingFt: options.stepFt ?? doc.snapFt ?? 1,
    idealClearanceFt: options.aisleWidth ?? UNIFIED_IDEAL_CLEARANCE_FT,
  })

  if (unified.placed.length === 0) {
    const fallback = packBoothsForRoom(doc, roomId, booths, options)
    return fallback
  }

  const roomPolygon = ringToRoomPolygon(surface.outerRings[0]!)
  const room = polygon(roomPolygon)
  const placed: BoothPlacement[] = []
  const unplaced = [...unified.unplaced]

  for (const p of unified.placed) {
    const booth = booths.find((b) => b.id === p.id)
    if (!booth) continue
    const global = {
      id: p.id,
      x: p.x + surface.minX,
      y: p.y + surface.minY,
      rotation: p.rotation,
    }
    const footprint = rotatedAabb({
      ...global,
      kind: 'booth',
      width: booth.width,
      height: booth.height,
      accentColor: null,
    })
    const ring = [
      [footprint.x, footprint.y],
      [footprint.x + footprint.width, footprint.y],
      [footprint.x + footprint.width, footprint.y + footprint.height],
      [footprint.x, footprint.y + footprint.height],
      [footprint.x, footprint.y],
    ]
    if (booleanWithin(polygon([ring]), room)) {
      placed.push(global)
    } else {
      unplaced.push(p.id)
    }
  }

  return {
    placed,
    unplaced: [...new Set(unplaced)],
    meta: {
      pathway: unified.meta.pathway.map((pt) => ({
        x: pt.x + surface.minX,
        y: pt.y + surface.minY,
      })),
      flowTerminals: {
        entrance: {
          x: unified.meta.flowTerminals.entrance.x + surface.minX,
          y: unified.meta.flowTerminals.entrance.y + surface.minY,
        },
        exit: {
          x: unified.meta.flowTerminals.exit.x + surface.minX,
          y: unified.meta.flowTerminals.exit.y + surface.minY,
        },
      },
      noFlyZoneCount: 0,
      exposureShifts: unified.meta.exposureShifts,
    },
    unifiedMeta: {
      ...unified.meta,
      pathway: unified.meta.pathway.map((pt) => ({
        x: pt.x + surface.minX,
        y: pt.y + surface.minY,
      })),
      clearanceField: unified.meta.clearanceField.map((c) => ({
        ...c,
        x: c.x + surface.minX,
        y: c.y + surface.minY,
      })),
    },
  }
}
