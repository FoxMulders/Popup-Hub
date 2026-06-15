import {
  packBoothsTrafficAware,
  type BoothPlacement as TrafficPlacement,
} from '@/components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
import { DEFAULT_AISLE_FT } from '@/lib/vendor-fairness-layout/constants'
import type { LayoutStrategy } from '../LayoutStrategy'
import type { BoothPlacement, LayoutRequest, LayoutResult, Point } from '../types'
import {
  exposureScoresFromPlacements,
  type PlacedBoothState,
} from '../fairness-engine/exposure-simulator'
import { computeFairnessScore } from '../fairness-engine/fairness-scorer'

function toPlacedStates(
  placed: TrafficPlacement[],
  request: LayoutRequest
): PlacedBoothState[] {
  const byId = new Map(request.booths.map((b) => [b.id, b]))
  return placed
    .map((p) => {
      const booth = byId.get(p.id)
      if (!booth) return null
      return { booth, x: p.x, y: p.y, rotation: p.rotation }
    })
    .filter((p): p is PlacedBoothState => p != null)
}

function toBoothPlacements(
  placed: TrafficPlacement[],
  request: LayoutRequest,
  scores: Map<string, number>,
  maxScore: number
): BoothPlacement[] {
  return placed.map((p) => ({
    boothId: p.id,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    exposureScore: (scores.get(p.id) ?? 0) / maxScore,
  }))
}

/**
 * Wraps existing traffic-aware packing — identical placement math to
 * `packBoothsTrafficAware` for the same inputs.
 */
export class TrafficAwareStrategy implements LayoutStrategy {
  async generateLayout(request: LayoutRequest): Promise<LayoutResult> {
    const bbox = roomBoundingBox(request.room.boundary)
    const roomW = request.roomWidthFt ?? bbox.width
    const roomH = request.roomHeightFt ?? bbox.height
    const aisleFt = request.aisleFt ?? DEFAULT_AISLE_FT
    const stepFt = request.stepFt ?? 0.5

    const traffic = packBoothsTrafficAware(
      roomW,
      roomH,
      request.booths.map((b) => ({ id: b.id, width: b.width, height: b.height })),
      {
        entrance: request.entrance,
        exit: request.exit,
        obstacles: request.obstacles,
        aisleWidth: aisleFt,
        stepFt,
        eventCategoryNames: request.eventCategoryNames,
        roomWidthFt: roomW,
        roomHeightFt: roomH,
      }
    )

    const route: Point[] = traffic.meta?.pathway ?? [
      request.entrance,
      request.exit,
    ]
  const states = toPlacedStates(traffic.placed, request)
  const rawScores = exposureScoresFromPlacements(route, states)
  const maxScore = Math.max(1, ...rawScores.values())
  const fairnessScore = computeFairnessScore(rawScores)

  return {
    placements: toBoothPlacements(traffic.placed, request, rawScores, maxScore),
      fairnessScore,
      route,
      unplacedBoothIds: traffic.unplaced,
    }
  }
}

export const trafficAwareStrategy = new TrafficAwareStrategy()
