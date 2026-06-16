/**
 * Coverage-gated booth placement — every accepted position must keep
 * PathfindingService route coverage at 100%.
 */

import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { buildNavigationGrid } from '@/components/coordinator/floor-plan-v2/engine/PathfindingService'
import {
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_WALL_INSET_FT,
} from '@/lib/vendor-fairness-layout/constants'
import type { Booth, LayoutRequest, Point } from '../types'
import type { PlacedBoothState } from './exposure-simulator'
import { meanExposureDistance } from './exposure-simulator'
import { placementIsValid } from './placement-validator'
import {
  buildPathfindingDocFromLayout,
  computeRouteCoverage,
  FAIRNESS_PATHFIND_ROOM_ID,
} from './route-coverage'

export interface PlacementCandidate {
  x: number
  y: number
  rotation: number
}

function coverageCellFt(request: LayoutRequest, placedCount: number): number {
  if (placedCount > 12) return 1
  if (placedCount > 8) return 0.75
  return request.stepFt ?? 0.5
}

/** True when the patron tour reaches every placed booth. */
export function maintainsFullRouteCoverage(
  request: LayoutRequest,
  placed: PlacedBoothState[],
  cellFt?: number
): boolean {
  if (placed.length === 0) return true
  const ft = cellFt ?? coverageCellFt(request, placed.length)
  return computeRouteCoverage(request, placed, { cellFt: ft }).isFullCoverage
}

function gridCellCenter(
  originX: number,
  originY: number,
  cellFt: number,
  col: number,
  row: number
): Point {
  return {
    x: originX + (col + 0.5) * cellFt,
    y: originY + (row + 0.5) * cellFt,
  }
}

function pathCumulativeDistances(route: Point[]): number[] {
  const cum: number[] = [0]
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  return cum
}

function pointAlongRoute(
  route: Point[],
  cum: number[],
  target: number
): { point: Point; tangentDeg: number } {
  for (let i = 1; i < route.length; i++) {
    const segStart = cum[i - 1]!
    const segEnd = cum[i]!
    if (target <= segEnd || i === route.length - 1) {
      const a = route[i - 1]!
      const b = route[i]!
      const segLen = segEnd - segStart || 1
      const u = Math.max(0, Math.min(1, (target - segStart) / segLen))
      const tangentDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      return {
        point: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
        tangentDeg,
      }
    }
  }
  const last = route[route.length - 1]!
  const prev = route[route.length - 2] ?? last
  const tangentDeg = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI
  return { point: { ...last }, tangentDeg }
}

function boothTopLeftFacingAisle(
  aislePoint: Point,
  booth: Booth,
  tangentDeg: number,
  sideSign: 1 | -1
): PlacementCandidate {
  const rad = (tangentDeg * Math.PI) / 180
  const normal = { x: -Math.sin(rad) * sideSign, y: Math.cos(rad) * sideSign }
  const facadeOffset = booth.height / 2
  const centerX = aislePoint.x + normal.x * facadeOffset
  const centerY = aislePoint.y + normal.y * facadeOffset
  const rot = sideSign > 0 ? tangentDeg : (tangentDeg + 180) % 360
  return {
    x: centerX - booth.width / 2,
    y: centerY - booth.height / 2,
    rotation: rot,
  }
}

function nearestRouteTangent(
  route: Point[],
  cum: number[],
  point: Point
): number {
  let bestDist = Infinity
  let bestTangent = 0
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2)
    )
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = Math.hypot(point.x - px, point.y - py)
    if (d < bestDist) {
      bestDist = d
      bestTangent = (Math.atan2(dy, dx) * 180) / Math.PI
    }
  }
  return bestTangent
}

/**
 * Slot candidates on walkable navigation cells adjacent to the serpentine route.
 * Rotations face the aisle (route tangent) — no arbitrary 90° spins.
 */
export function buildWalkableRouteSlotCandidates(
  request: LayoutRequest,
  route: Point[],
  placed: PlacedBoothState[],
  booth: Booth,
  options: {
    aisleFt: number
    corridorWidthFt?: number
    aisleSideBias?: 'both' | 'left' | 'right' | 'left-first' | 'right-first'
  }
): PlacementCandidate[] {
  if (route.length < 2) return []

  const cellFt = coverageCellFt(request, placed.length + 1)
  const { doc, roomBoundary } = buildPathfindingDocFromLayout(request, placed, {
    snapFt: cellFt,
  })
  const grid = buildNavigationGrid(doc, FAIRNESS_PATHFIND_ROOM_ID, {
    cellFt,
    roomBoundary,
    booths: placed.map((p) => ({
      id: p.booth.id,
      kind: 'booth' as const,
      x: p.x,
      y: p.y,
      width: p.booth.width,
      height: p.booth.height,
      rotation: p.rotation,
    })),
  })
  if (!grid) return []

  const corridorWidthFt = options.corridorWidthFt ?? DEFAULT_CORRIDOR_WIDTH_FT
  const aisleFt = options.aisleFt
  const depth = Math.max(booth.width, booth.height)
  const marginOffset = corridorWidthFt / 2 + depth / 2 + aisleFt
  const pitchAlong = Math.max(booth.width + aisleFt * 0.5, depth * 0.65 + aisleFt)
  const cum = pathCumulativeDistances(route)
  const total = cum[cum.length - 1] ?? 0
  if (total < 1) return []

  const signs: ReadonlyArray<1 | -1> =
    options.aisleSideBias === 'left'
      ? [1]
      : options.aisleSideBias === 'right'
        ? [-1]
        : options.aisleSideBias === 'left-first'
          ? [1, -1]
          : options.aisleSideBias === 'right-first'
            ? [-1, 1]
            : [1, -1]

  const seen = new Set<string>()
  const candidates: PlacementCandidate[] = []
  const searchRadius = Math.ceil(marginOffset / grid.cellFt) + 1

  for (let dist = pitchAlong * 0.35; dist < total; dist += pitchAlong) {
    const { point, tangentDeg } = pointAlongRoute(route, cum, dist)
    const rad = (tangentDeg * Math.PI) / 180
    const leftNormal = { x: -Math.sin(rad), y: Math.cos(rad) }

    for (const sign of signs) {
      const targetX = point.x + leftNormal.x * marginOffset * sign
      const targetY = point.y + leftNormal.y * marginOffset * sign
      const col = Math.round((targetX - grid.originX) / grid.cellFt - 0.5)
      const row = Math.round((targetY - grid.originY) / grid.cellFt - 0.5)

      for (let dr = -searchRadius; dr <= searchRadius; dr++) {
        for (let dc = -searchRadius; dc <= searchRadius; dc++) {
          const nr = row + dr
          const nc = col + dc
          if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) continue
          if (!grid.walkable[nr]![nc]) continue

          const aislePoint = gridCellCenter(
            grid.originX,
            grid.originY,
            grid.cellFt,
            nc,
            nr
          )
          const distToTarget = Math.hypot(
            aislePoint.x - targetX,
            aislePoint.y - targetY
          )
          if (distToTarget > grid.cellFt * (searchRadius + 0.5)) continue

          const tangent = nearestRouteTangent(route, cum, aislePoint)
          const placement = boothTopLeftFacingAisle(
            aislePoint,
            booth,
            tangent,
            sign
          )
          const key = `${placement.x.toFixed(2)},${placement.y.toFixed(2)},${placement.rotation}`
          if (seen.has(key)) continue
          seen.add(key)
          candidates.push(placement)
        }
      }
    }
  }

  return candidates
}

/**
 * Accept the first candidate that is geometrically valid and keeps 100% route coverage.
 */
export function tryPlaceWithFullCoverage(
  booth: Booth,
  candidates: Iterable<PlacementCandidate>,
  request: LayoutRequest,
  route: Point[],
  aisleFt: number,
  obstacles: Rect[],
  placed: PlacedBoothState[]
): PlacedBoothState | null {
  const cellFt = coverageCellFt(request, placed.length + 1)
  const scored: Array<{ c: PlacementCandidate; dist: number }> = []

  for (const c of candidates) {
    if (
      !placementIsValid(
        c.x,
        c.y,
        booth,
        c.rotation,
        request.room,
        aisleFt,
        obstacles,
        placed
      )
    ) {
      continue
    }
    scored.push({
      c,
      dist: meanExposureDistance(c.x, c.y, booth, route, c.rotation),
    })
  }

  scored.sort((a, b) => a.dist - b.dist)

  for (const { c } of scored) {
    const trial: PlacedBoothState[] = [
      ...placed,
      { booth, x: c.x, y: c.y, rotation: c.rotation },
    ]
    if (maintainsFullRouteCoverage(request, trial, cellFt)) {
      return { booth, x: c.x, y: c.y, rotation: c.rotation }
    }
  }

  return null
}

/**
 * Drop booths unreachable by the patron tour until coverage is 100% or empty.
 * Not used by the main fairness pipeline — removal is only allowed for proven physical capacity.
 */
export function pruneToFullRouteCoverage(
  request: LayoutRequest,
  placed: PlacedBoothState[]
): { placed: PlacedBoothState[]; droppedIds: string[] } {
  let current = [...placed]
  const dropped: string[] = []

  for (let guard = 0; guard < placed.length + 2; guard++) {
    if (current.length === 0) break
    const cov = computeRouteCoverage(request, current)
    if (cov.isFullCoverage) break

    const removeIds =
      cov.missedBoothIds.length > 0
        ? cov.missedBoothIds
        : [current[current.length - 1]!.booth.id]

    const removeSet = new Set(removeIds)
    const next = current.filter((p) => !removeSet.has(p.booth.id))
    for (const id of removeIds) {
      if (current.some((p) => p.booth.id === id)) dropped.push(id)
    }
    if (next.length === current.length) break
    current = next
  }

  return { placed: current, droppedIds: dropped }
}

/** Margin grid fallback — route-facing rotations only (no arbitrary 90°). */
export function* marginGridRouteFacingCandidates(
  request: LayoutRequest,
  route: Point[],
  stepFt: number,
  wallInsetFt: number,
  booth: Booth
): Generator<PlacementCandidate> {
  const bbox = request.room.boundary.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxX: Math.max(acc.maxX, p.x),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  )
  const cum = pathCumulativeDistances(route)
  const pitchX = Math.max(stepFt, booth.width * 0.35)
  const pitchY = Math.max(stepFt, booth.height * 0.35)

  for (
    let y = bbox.minY + wallInsetFt;
    y <= bbox.maxY - wallInsetFt - booth.height;
    y += pitchY
  ) {
    for (
      let x = bbox.minX + wallInsetFt;
      x <= bbox.maxX - wallInsetFt - booth.width;
      x += pitchX
    ) {
      const center = { x: x + booth.width / 2, y: y + booth.height / 2 }
      const tangent = nearestRouteTangent(route, cum, center)
      yield boothTopLeftFacingAisle(center, booth, tangent, 1)
      yield boothTopLeftFacingAisle(center, booth, tangent, -1)
    }
  }
}

export { DEFAULT_WALL_INSET_FT, DEFAULT_CORRIDOR_WIDTH_FT }
