/**
 * Dynamic floor-plan tessellation — evaluates perimeter, grid, and staggered
 * patterns for a W×L canvas and booth count, then picks the highest valid yield.
 */

import { nextAnimationFrame } from '@/lib/booth-planner/placement-guard'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  autoArrangeInRoom,
  type AutoArrangeInRoomResult,
  type AutoArrangeMode,
  type AutoArrangeOptions,
} from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  buildPatronPathway,
  PATRON_CORRIDOR_WIDTH_FT,
} from '@/components/coordinator/floor-plan-v2/engine/patron-centric-layout'
import { evaluateTrafficFlowPrerequisites } from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import {
  applyClearanceAutoCorrection,
  countGreenVendorBooths,
} from '@/lib/floor-plan/clearance-auto-correction'
import { computeRouteCoverage } from '@/lib/layout-strategies/fairness-engine/route-coverage'
import { layoutRequestFromDocRoom } from '@/lib/layout-strategies/adapters/floor-plan-doc-adapter'

export type TessellationPatternId =
  | 'perimeter-loop'
  | 'structured-grid'
  | 'staggered-offset'

export interface TessellationPattern {
  id: TessellationPatternId
  mode: AutoArrangeMode
  label: string
}

export const TESSELLATION_PATTERNS: ReadonlyArray<TessellationPattern> = [
  {
    id: 'perimeter-loop',
    mode: 'perimeter-only',
    label: 'Perimeter loop with central island walkway',
  },
  {
    id: 'structured-grid',
    mode: 'grid',
    label: 'Structured grid blocks with uniform avenues',
  },
  {
    id: 'staggered-offset',
    mode: 'staggered',
    label: 'Staggered offset rows for density and sightlines',
  },
]

export interface TessellationCandidateScore {
  patternId: TessellationPatternId
  validBoothYield: number
  placedYield: number
  flowFairness: number
  greenBoothCount: number
  placedCount: number
  prunedCount: number
  composite: number
}

export interface TessellationOptimizationResult extends AutoArrangeInRoomResult {
  tessellationOptimized: true
  winningPattern: TessellationPatternId
  patternScores: TessellationCandidateScore[]
  clearanceCorrection: {
    prunedIds: string[]
    pushBackIterations: number
    allGreen: boolean
  }
  layoutExplanation?: string
}

function facadeCenter(booth: BoothObject): { x: number; y: number } {
  const cx = booth.x + booth.width / 2
  const cy = booth.y + booth.height / 2
  const rad = ((booth.rotation ?? 0) * Math.PI) / 180
  return {
    x: cx + Math.sin(rad) * (booth.height * 0.5),
    y: cy - Math.cos(rad) * (booth.height * 0.5),
  }
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-9) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

function distToPolyline(
  px: number,
  py: number,
  path: Array<{ x: number; y: number }>
): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    best = Math.min(
      best,
      distPointToSegment(px, py, a.x, a.y, b.x, b.y)
    )
  }
  return best
}

function vendorBoothsGlobal(
  doc: FloorPlanDoc,
  roomId: string
): BoothObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter(
    (o): o is BoothObject =>
      o.kind === 'booth' &&
      !isGuestTableBooth(o) &&
      isVendorBoothObject(o) &&
      objectRoom[o.id] === roomId
  )
}

function sourceVendorCount(doc: FloorPlanDoc, roomId: string): number {
  return vendorBoothsGlobal(doc, roomId).length
}

/** Fraction of vendor booths whose storefront intersects the primary patron flow line. */
export function scoreFlowFairness(
  doc: FloorPlanDoc,
  roomId: string
): number {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return 0

  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const localW = surface
    ? Math.max(1, surface.maxX - surface.minX)
    : frame.widthFt
  const localL = surface
    ? Math.max(1, surface.maxY - surface.minY)
    : frame.lengthFt

  const vendors = vendorBoothsGlobal(doc, roomId).map((b) => ({
    ...b,
    x: b.x - originX,
    y: b.y - originY,
  }))
  if (vendors.length === 0) return 1

  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const entrance = traffic.entryDoors[0]
    ? { x: traffic.entryDoors[0].centerX - originX, y: traffic.entryDoors[0].centerY - originY }
    : { x: localW / 2, y: localL - 4 }
  const exit = traffic.exitDoors[0]
    ? { x: traffic.exitDoors[0].centerX - originX, y: traffic.exitDoors[0].centerY - originY }
    : { x: localW / 2, y: 4 }

  const maxDepth = Math.max(...vendors.map((b) => b.height), 4)
  const pathway = buildPatronPathway(
    localW,
    localL,
    entrance,
    exit,
    PATRON_CORRIDOR_WIDTH_FT,
    maxDepth
  )

  const maxSightlineFt = PATRON_CORRIDOR_WIDTH_FT / 2 + 5
  let facing = 0
  for (const booth of vendors) {
    const facade = facadeCenter(booth)
    const dist = distToPolyline(facade.x, facade.y, pathway)
    if (dist <= maxSightlineFt) facing++
  }

  let routeCoverage = facing / vendors.length
  if (traffic.satisfied) {
    const request = layoutRequestFromDocRoom(doc, roomId, vendors)
    if (request) {
      const coverage = computeRouteCoverage(
        request,
        vendors.map((b) => ({
          booth: { id: b.id, width: b.width, height: b.height },
          x: b.x,
          y: b.y,
          rotation: b.rotation ?? 0,
        }))
      )
      routeCoverage = Math.max(
        routeCoverage,
        coverage.coveragePercentage / 100
      )
    }
  }

  return Math.min(1, routeCoverage)
}

export interface TessellationOptimizeOptions extends AutoArrangeOptions {
  /** Progressive canvas preview after each pattern is evaluated (best-so-far). */
  onProgress?: (
    doc: FloorPlanDoc,
    bestPattern: TessellationPatternId,
    scores: TessellationCandidateScore[]
  ) => void
}

function scoreCandidate(
  patternId: TessellationPatternId,
  result: AutoArrangeInRoomResult,
  correctedDoc: FloorPlanDoc,
  sourceCount: number,
  prunedCount: number,
  roomId: string
): TessellationCandidateScore {
  const { green, total } = countGreenVendorBooths(correctedDoc, roomId)
  const validBoothYield = sourceCount > 0 ? green / sourceCount : 1
  const placedYield =
    sourceCount > 0 ? Math.min(1, result.placedCount / sourceCount) : 1
  const flowFairness = scoreFlowFairness(correctedDoc, roomId)

  const composite =
    validBoothYield * 1000 +
    flowFairness * 100 +
    placedYield * 10 -
    result.unsatisfiedCategoryCount * 0.5 -
    prunedCount * 0.25

  return {
    patternId,
    validBoothYield,
    placedYield,
    flowFairness,
    greenBoothCount: green,
    placedCount: result.placedCount,
    prunedCount,
    composite,
  }
}

function rankScores(
  scores: TessellationCandidateScore[]
): TessellationCandidateScore[] {
  return [...scores].sort((a, b) => {
    if (b.validBoothYield !== a.validBoothYield) {
      return b.validBoothYield - a.validBoothYield
    }
    if (b.flowFairness !== a.flowFairness) {
      return b.flowFairness - a.flowFairness
    }
    if (b.placedCount !== a.placedCount) {
      return b.placedCount - a.placedCount
    }
    return b.composite - a.composite
  })
}

/**
 * Evaluate all three tessellation patterns, apply clearance auto-correction,
 * and return the highest-yield layout whose booths face the patron flow line.
 */
export function optimizeTessellatedLayout(
  doc: FloorPlanDoc,
  roomId: string,
  options: AutoArrangeOptions = {}
): TessellationOptimizationResult | null {
  const sourceCount = sourceVendorCount(doc, roomId)
  const candidates: Array<{
    pattern: TessellationPattern
    result: AutoArrangeInRoomResult
    corrected: ReturnType<typeof applyClearanceAutoCorrection>
  }> = []

  for (const pattern of TESSELLATION_PATTERNS) {
    const result = autoArrangeInRoom(doc, roomId, {
      ...options,
      mode: pattern.mode,
      dropUnplacedBooths: options.dropUnplacedBooths ?? true,
    })
    if (!result || result.placedCount === 0) continue

    const corrected = applyClearanceAutoCorrection(result.doc, { roomId })
    candidates.push({ pattern, result, corrected })
  }

  if (candidates.length === 0) return null

  const scores = candidates.map(({ pattern, result, corrected }) =>
    scoreCandidate(
      pattern.id,
      result,
      corrected.doc,
      sourceCount,
      corrected.prunedIds.length,
      roomId
    )
  )
  const ranked = rankScores(scores)
  const winnerScore = ranked[0]!
  const winnerIdx = candidates.findIndex(
    (c) => c.pattern.id === winnerScore.patternId
  )
  const winner = candidates[winnerIdx]!
  const winnerPattern = winner.pattern
  const droppedFromCorrection = winner.corrected.prunedIds.length

  const explanation = [
    `Tessellation winner: ${winnerPattern.label}.`,
    `Valid booth yield ${(winnerScore.validBoothYield * 100).toFixed(0)}%`,
    `· flow fairness ${(winnerScore.flowFairness * 100).toFixed(0)}%`,
    `· ${winnerScore.greenBoothCount} green-clearance booth${winnerScore.greenBoothCount === 1 ? '' : 's'}.`,
    droppedFromCorrection > 0
      ? ` Pruned ${droppedFromCorrection} booth${droppedFromCorrection === 1 ? '' : 's'} to reach ≥4′ clearance.`
      : winner.corrected.pushBackIterations > 0
        ? ` Push-back resolved ${winner.corrected.pushBackIterations} clearance conflict${winner.corrected.pushBackIterations === 1 ? '' : 's'}.`
        : '',
  ].join('')

  return {
    ...winner.result,
    doc: winner.corrected.doc,
    placedCount: Math.max(
      0,
      winner.result.placedCount - droppedFromCorrection
    ),
    droppedCount: winner.result.droppedCount + droppedFromCorrection,
    removedOverlapCount:
      winner.result.removedOverlapCount + droppedFromCorrection,
    roomId,
    tessellationOptimized: true,
    winningPattern: winnerPattern.id,
    patternScores: ranked,
    clearanceCorrection: {
      prunedIds: [...winner.corrected.prunedIds],
      pushBackIterations: winner.corrected.pushBackIterations,
      allGreen: winner.corrected.allGreen,
    },
    layoutExplanation: explanation,
  }
}

/** Async variant — yields between pattern evaluations for UI responsiveness. */
export async function optimizeTessellatedLayoutAsync(
  doc: FloorPlanDoc,
  roomId: string,
  options: TessellationOptimizeOptions = {}
): Promise<TessellationOptimizationResult | null> {
  const sourceCount = sourceVendorCount(doc, roomId)
  const candidates: Array<{
    pattern: TessellationPattern
    result: AutoArrangeInRoomResult
    corrected: ReturnType<typeof applyClearanceAutoCorrection>
  }> = []

  for (const pattern of TESSELLATION_PATTERNS) {
    await nextAnimationFrame()
    const result = autoArrangeInRoom(doc, roomId, {
      ...options,
      mode: pattern.mode,
      dropUnplacedBooths: options.dropUnplacedBooths ?? true,
    })
    if (!result || result.placedCount === 0) continue
    const corrected = applyClearanceAutoCorrection(result.doc, { roomId })
    candidates.push({ pattern, result, corrected })

    if (options.onProgress) {
      const scores = candidates.map(({ pattern: p, result: r, corrected: c }) =>
        scoreCandidate(
          p.id,
          r,
          c.doc,
          sourceCount,
          c.prunedIds.length,
          roomId
        )
      )
      const ranked = rankScores(scores)
      const best = candidates.find((c) => c.pattern.id === ranked[0]!.patternId)!
      options.onProgress(best.corrected.doc, ranked[0]!.patternId, ranked)
    }
  }

  if (candidates.length === 0) return null

  const scores = candidates.map(({ pattern, result, corrected }) =>
    scoreCandidate(
      pattern.id,
      result,
      corrected.doc,
      sourceCount,
      corrected.prunedIds.length,
      roomId
    )
  )
  const ranked = rankScores(scores)
  const winnerScore = ranked[0]!
  const winner = candidates.find((c) => c.pattern.id === winnerScore.patternId)!
  const droppedFromCorrection = winner.corrected.prunedIds.length

  return {
    ...winner.result,
    doc: winner.corrected.doc,
    placedCount: Math.max(
      0,
      winner.result.placedCount - droppedFromCorrection
    ),
    droppedCount: winner.result.droppedCount + droppedFromCorrection,
    removedOverlapCount:
      winner.result.removedOverlapCount + droppedFromCorrection,
    roomId,
    tessellationOptimized: true,
    winningPattern: winner.pattern.id,
    patternScores: ranked,
    clearanceCorrection: {
      prunedIds: winner.corrected.prunedIds,
      pushBackIterations: winner.corrected.pushBackIterations,
      allGreen: winner.corrected.allGreen,
    },
    layoutExplanation: [
      `Tessellation winner: ${winner.pattern.label}.`,
      `Valid booth yield ${(winnerScore.validBoothYield * 100).toFixed(0)}%`,
      `· flow fairness ${(winnerScore.flowFairness * 100).toFixed(0)}%.`,
    ].join(' '),
  }
}
