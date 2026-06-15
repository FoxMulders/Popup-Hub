import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { SerpentineAisleOptions } from '@/lib/vendor-fairness-layout/geometry/aisle-skeleton'
import {
  buildSerpentineAisle,
  maxBoothDepth,
} from '@/lib/vendor-fairness-layout/geometry'
import {
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_WALL_INSET_FT,
} from '@/lib/vendor-fairness-layout/constants'
import type {
  Booth,
  FairLayoutAisleSideBias,
  FairLayoutPrimaryAxis,
  LayoutRequest,
  Point,
} from '../types'
import type { PlacedBoothState } from './exposure-simulator'
import { meanExposureDistance } from './exposure-simulator'
import {
  buildWalkableRouteSlotCandidates,
  marginGridRouteFacingCandidates,
  tryPlaceWithFullCoverage,
} from './coverage-aware-placement'

interface AisleSlot {
  x: number
  y: number
  rotation: number
  pathDist: number
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

function boothTopLeftForMargin(
  cx: number,
  cy: number,
  booth: Booth,
  tangentDeg: number,
  sideSign: 1 | -1
): { x: number; y: number; rotation: number } {
  const rad = (tangentDeg * Math.PI) / 180
  const normal = { x: -Math.sin(rad) * sideSign, y: Math.cos(rad) * sideSign }
  const facadeOffset = booth.height / 2
  const centerX = cx + normal.x * facadeOffset
  const centerY = cy + normal.y * facadeOffset
  const rot = sideSign > 0 ? tangentDeg : (tangentDeg + 180) % 360
  return {
    x: centerX - booth.width / 2,
    y: centerY - booth.height / 2,
    rotation: rot,
  }
}

function aisleSideSigns(bias: FairLayoutAisleSideBias): ReadonlyArray<1 | -1> {
  switch (bias) {
    case 'left':
      return [1]
    case 'right':
      return [-1]
    case 'left-first':
      return [1, -1]
    case 'right-first':
      return [-1, 1]
    default:
      return [1, -1]
  }
}

function buildAisleSlots(
  route: Point[],
  corridorWidthFt: number,
  aisleFt: number,
  booths: Booth[],
  aisleSideBias: FairLayoutAisleSideBias = 'both'
): AisleSlot[] {
  if (route.length < 2 || booths.length === 0) return []

  const cum = pathCumulativeDistances(route)
  const total = cum[cum.length - 1] ?? 0
  if (total < 1) return []

  const avgW = booths.reduce((s, b) => s + b.width, 0) / booths.length
  const avgH = booths.reduce((s, b) => s + b.height, 0) / booths.length
  const depth = maxBoothDepth(booths)
  const marginOffset = corridorWidthFt / 2 + depth / 2 + aisleFt
  const pitchAlong = Math.max(avgW + aisleFt * 0.5, depth * 0.65 + aisleFt)
  const slots: AisleSlot[] = []
  const signs = aisleSideSigns(aisleSideBias)

  for (let dist = pitchAlong * 0.35; dist < total; dist += pitchAlong) {
    const { point, tangentDeg } = pointAlongRoute(route, cum, dist)
    const rad = (tangentDeg * Math.PI) / 180
    const leftNormal = { x: -Math.sin(rad), y: Math.cos(rad) }

    for (const sign of signs) {
      const cx = point.x + leftNormal.x * marginOffset * sign
      const cy = point.y + leftNormal.y * marginOffset * sign
      const refBooth: Booth = { id: '__', width: avgW, height: avgH }
      const placement = boothTopLeftForMargin(cx, cy, refBooth, tangentDeg, sign)
      slots.push({
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        pathDist: dist + (sign > 0 ? 0 : 0.001),
      })
    }
  }

  slots.sort((a, b) => a.pathDist - b.pathDist)
  return slots
}

function buildAisleSlotsForBooth(
  route: Point[],
  corridorWidthFt: number,
  aisleFt: number,
  booth: Booth,
  aisleSideBias: FairLayoutAisleSideBias = 'both'
): AisleSlot[] {
  if (route.length < 2) return []

  const cum = pathCumulativeDistances(route)
  const total = cum[cum.length - 1] ?? 0
  if (total < 1) return []

  const depth = Math.max(booth.width, booth.height)
  const marginOffset = corridorWidthFt / 2 + depth / 2 + aisleFt
  const pitchAlong = Math.max(booth.width + aisleFt * 0.5, depth * 0.65 + aisleFt)
  const slots: AisleSlot[] = []
  const signs = aisleSideSigns(aisleSideBias)

  for (let dist = pitchAlong * 0.35; dist < total; dist += pitchAlong) {
    const { point, tangentDeg } = pointAlongRoute(route, cum, dist)
    const rad = (tangentDeg * Math.PI) / 180
    const leftNormal = { x: -Math.sin(rad), y: Math.cos(rad) }

    for (const sign of signs) {
      const cx = point.x + leftNormal.x * marginOffset * sign
      const cy = point.y + leftNormal.y * marginOffset * sign
      const placement = boothTopLeftForMargin(cx, cy, booth, tangentDeg, sign)
      slots.push({
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        pathDist: dist + (sign > 0 ? 0 : 0.001),
      })
    }
  }

  slots.sort((a, b) => a.pathDist - b.pathDist)
  return slots
}

function* serpentineAisleCandidates(
  route: Point[],
  corridorWidthFt: number,
  aisleFt: number,
  booth: Booth,
  aisleSideBias: FairLayoutAisleSideBias
): Generator<{ x: number; y: number; rotation: number }> {
  for (const s of buildAisleSlotsForBooth(
    route,
    corridorWidthFt,
    aisleFt,
    booth,
    aisleSideBias
  )) {
    yield { x: s.x, y: s.y, rotation: s.rotation }
  }
  for (const s of buildAisleSlots(
    route,
    corridorWidthFt,
    aisleFt,
    [booth],
    aisleSideBias
  )) {
    yield { x: s.x, y: s.y, rotation: s.rotation }
  }
}

/**
 * Polygon-aware serpentine seed — booths along clipped aisle margins, then route-biased grid.
 */
export function seedFairnessPlacements(
  request: LayoutRequest,
  options: {
    aisleFt: number
    stepFt: number
    corridorWidthFt?: number
    wallInsetFt?: number
    obstacles?: Rect[]
    primaryAxis?: FairLayoutPrimaryAxis
    reverseFlow?: boolean
    aisleSideBias?: FairLayoutAisleSideBias
  }
): { placed: PlacedBoothState[]; unplaced: string[]; route: Point[] } {
  const aisleFt = options.aisleFt
  const stepFt = options.stepFt
  const corridorWidthFt = options.corridorWidthFt ?? DEFAULT_CORRIDOR_WIDTH_FT
  const wallInsetFt = options.wallInsetFt ?? DEFAULT_WALL_INSET_FT
  const obstacles = options.obstacles ?? []
  const depth = maxBoothDepth(request.booths)

  const serpentineOpts: SerpentineAisleOptions = {}
  if (options.primaryAxis != null) {
    serpentineOpts.primaryAxis = options.primaryAxis
  }
  if (options.reverseFlow != null) {
    serpentineOpts.reverseFlow = options.reverseFlow
  }

  const aisle = buildSerpentineAisle(
    request.room,
    request.entrance,
    request.exit,
    depth,
    corridorWidthFt,
    wallInsetFt,
    serpentineOpts
  )
  const route = aisle.centerline
  const aisleSideBias = options.aisleSideBias ?? 'both'
  const baseSlots = buildAisleSlots(
    route,
    corridorWidthFt,
    aisleFt,
    request.booths,
    aisleSideBias
  )

  const booths = [...request.booths].sort(
    (a, b) => b.width * b.height - a.width * a.height
  )
  const placed: PlacedBoothState[] = []
  const unplaced: string[] = []

  for (const booth of booths) {
    const walkableSlots = buildWalkableRouteSlotCandidates(
      request,
      route,
      placed,
      booth,
      { aisleFt, corridorWidthFt, aisleSideBias }
    )

    const state =
      tryPlaceWithFullCoverage(
        booth,
        walkableSlots,
        request,
        route,
        aisleFt,
        obstacles,
        placed
      ) ??
      tryPlaceWithFullCoverage(
        booth,
        serpentineAisleCandidates(
          route,
          corridorWidthFt,
          aisleFt,
          booth,
          aisleSideBias
        ),
        request,
        route,
        aisleFt,
        obstacles,
        placed
      ) ??
      tryPlaceWithFullCoverage(
        booth,
        baseSlots.map((s) => ({ x: s.x, y: s.y, rotation: s.rotation })),
        request,
        route,
        aisleFt,
        obstacles,
        placed
      ) ??
      tryPlaceWithFullCoverage(
        booth,
        marginGridRouteFacingCandidates(
          request,
          route,
          stepFt,
          wallInsetFt,
          booth
        ),
        request,
        route,
        aisleFt,
        obstacles,
        placed
      )

    if (state) {
      placed.push(state)
    } else {
      unplaced.push(booth.id)
    }
  }

  return { placed, unplaced, route }
}

/** Greedily accept traffic-aware placements that preserve 100% route coverage. */
export function filterTrafficSeed(
  trafficPlaced: Array<{
    id: string
    x: number
    y: number
    rotation: number
  }>,
  booths: Booth[],
  request: LayoutRequest,
  aisleFt: number,
  obstacles: Rect[],
  route: Point[],
  existingPlaced: PlacedBoothState[] = []
): { placed: PlacedBoothState[]; unplaced: string[] } {
  const byId = new Map(booths.map((b) => [b.id, b]))
  const working: PlacedBoothState[] = [...existingPlaced]
  const placedIds = new Set(working.map((p) => p.booth.id))
  const newFromTraffic: PlacedBoothState[] = []
  const unplaced: string[] = []
  const maxRouteDist = aisleFt * 4 + maxBoothDepth(booths)

  const sorted = [...trafficPlaced]
    .filter((p) => !placedIds.has(p.id))
    .sort((a, b) => {
      const ba = byId.get(a.id)
      const bb = byId.get(b.id)
      if (!ba || !bb) return 0
      return (
        meanExposureDistance(a.x, a.y, ba, route, a.rotation) -
        meanExposureDistance(b.x, b.y, bb, route, b.rotation)
      )
    })

  for (const p of sorted) {
    const booth = byId.get(p.id)
    if (!booth) continue
    if (meanExposureDistance(p.x, p.y, booth, route, p.rotation) > maxRouteDist) {
      unplaced.push(p.id)
      continue
    }

    const accepted = tryPlaceWithFullCoverage(
      booth,
      [{ x: p.x, y: p.y, rotation: p.rotation }],
      request,
      route,
      aisleFt,
      obstacles,
      working
    )
    if (accepted) {
      working.push(accepted)
      newFromTraffic.push(accepted)
      placedIds.add(p.id)
    } else {
      unplaced.push(p.id)
    }
  }

  for (const b of booths) {
    if (!placedIds.has(b.id) && !unplaced.includes(b.id)) {
      unplaced.push(b.id)
    }
  }

  return { placed: newFromTraffic, unplaced }
}
