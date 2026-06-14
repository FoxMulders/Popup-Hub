import {
  DEFAULT_AISLE_FT,
  DEFAULT_ATTENDEE_COUNT,
  DEFAULT_CELL_FT,
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_TIME_BUDGET_MS,
  DEFAULT_WALL_INSET_FT,
} from './constants'
import type { BoothPlacement, GenerateOptions, LayoutRequest, LayoutResult } from './types'
import { validateRoomBoundary } from './geometry'
import { simulateExposure } from './exposure'
import { generateRoute } from './route'
import { computeFairnessScore } from './scoring'
import { optimizeLayout, seedLayout } from './optimizer'

/**
 * Generate a vendor-fair booth layout optimized for equal attendee exposure.
 *
 * Runs in browser or Node.js — no external APIs.
 */
export function generateFairLayout(
  request: LayoutRequest,
  options: GenerateOptions = {}
): LayoutResult {
  const roomCheck = validateRoomBoundary(request.room.boundary)
  if (!roomCheck.ok) {
    throw new Error(roomCheck.reason ?? 'Invalid room boundary')
  }

  const wallInsetFt = options.wallInsetFt ?? DEFAULT_WALL_INSET_FT
  const aisleFt = options.aisleFt ?? DEFAULT_AISLE_FT
  const corridorWidthFt = options.corridorWidthFt ?? DEFAULT_CORRIDOR_WIDTH_FT
  const boothCount = request.booths.length
  const attendeeCount =
    options.attendeeCount ?? (boothCount > 100 ? 400 : DEFAULT_ATTENDEE_COUNT)
  const timeBudgetMs =
    options.timeBudgetMs ??
    (boothCount > 150 ? 1200 : boothCount > 50 ? 1500 : DEFAULT_TIME_BUDGET_MS)
  const cellFt = options.cellFt ?? DEFAULT_CELL_FT

  const { booths: seeded, aisle } = seedLayout(
    request.room,
    request.booths,
    request.entrance,
    request.exit,
    aisleFt,
    corridorWidthFt,
    wallInsetFt
  )

  const optimized =
    boothCount > 3
      ? optimizeLayout(seeded, {
          room: request.room,
          entrance: request.entrance,
          exit: request.exit,
          aisle,
          timeBudgetMs,
          aisleFt,
          attendeeCount: Math.min(attendeeCount, boothCount > 100 ? 250 : 500),
        })
      : { booths: seeded, variance: 0, route: [] as import('./types').Point[] }

  const routeResult = generateRoute(
    request.room,
    request.entrance,
    request.exit,
    optimized.booths,
    aisle,
    cellFt
  )

  const exposure = simulateExposure({
    booths: optimized.booths,
    route: routeResult.route,
    entrance: request.entrance,
    exit: request.exit,
    attendeeCount,
  })

  const fairness = computeFairnessScore(exposure, optimized.booths)
  const exposureById = new Map(exposure.map((e) => [e.boothId, e.score]))

  const placements: BoothPlacement[] = optimized.booths.map((b) => ({
    boothId: b.id,
    x: b.x,
    y: b.y,
    rotation: b.rotation,
    exposureScore: exposureById.get(b.id) ?? 0,
  }))

  return {
    placements,
    fairnessScore: fairness.fairnessScore,
    route: routeResult.route,
  }
}

export * from './types'
export * from './constants'
export * from './geometry'
export * from './graph'
export * from './route'
export * from './exposure'
export * from './scoring'
export * from './optimizer'
