import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  buildSerpentineAisle,
  maxBoothDepth,
} from '@/lib/vendor-fairness-layout/geometry'
import {
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_WALL_INSET_FT,
} from '@/lib/vendor-fairness-layout/constants'
import type { Booth, LayoutRequest, Point } from '../types'
import type { PlacedBoothState } from './exposure-simulator'
import { placementIsValid, roomExtent } from './placement-validator'

interface AisleSlot {
  x: number
  y: number
  rotation: number
}

function buildAisleSlots(
  centerline: Point[],
  corridorWidthFt: number,
  maxDepth: number,
  aisleFt: number
): AisleSlot[] {
  const slots: AisleSlot[] = []
  const offset = corridorWidthFt / 2 + maxDepth / 2 + aisleFt

  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i]!
    const b = centerline[i + 1]!
    const tangent = Math.atan2(b.y - a.y, b.x - a.x)
    const rot = (tangent * 180) / Math.PI
    const normal = { x: -Math.sin(tangent), y: Math.cos(tangent) }

    for (const sign of [1, -1] as const) {
      slots.push({
        x: a.x + normal.x * offset * sign - maxDepth / 2,
        y: a.y + normal.y * offset * sign - maxDepth / 2,
        rotation: sign > 0 ? rot : (rot + 180) % 360,
      })
    }
  }

  return slots
}

function* gridScanCandidates(
  request: LayoutRequest,
  stepFt: number,
  wallInsetFt: number
): Generator<{ x: number; y: number; rotation: number }> {
  const bbox = roomExtent(request.room.boundary)
  const booths = request.booths
  if (booths.length === 0) return

  const avgW = booths.reduce((s, b) => s + b.width, 0) / booths.length
  const avgH = booths.reduce((s, b) => s + b.height, 0) / booths.length
  const pitchX = Math.max(stepFt, avgW * 0.25)
  const pitchY = Math.max(stepFt, avgH * 0.25)

  for (
    let y = bbox.y + wallInsetFt;
    y <= bbox.y + bbox.height - wallInsetFt - avgH;
    y += pitchY
  ) {
    for (
      let x = bbox.x + wallInsetFt;
      x <= bbox.x + bbox.width - wallInsetFt - avgW;
      x += pitchX
    ) {
      yield { x, y, rotation: 0 }
      yield { x, y, rotation: 90 }
    }
  }
}

function tryPlaceBooth(
  booth: Booth,
  candidates: Iterable<{ x: number; y: number; rotation: number }>,
  request: LayoutRequest,
  aisleFt: number,
  obstacles: Rect[],
  placed: PlacedBoothState[]
): PlacedBoothState | null {
  for (const c of candidates) {
    if (
      placementIsValid(
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
      return { booth, x: c.x, y: c.y, rotation: c.rotation }
    }
  }
  return null
}

/**
 * Polygon-aware serpentine seed — booths along clipped aisle margins, then grid scan.
 */
export function seedFairnessPlacements(
  request: LayoutRequest,
  options: {
    aisleFt: number
    stepFt: number
    corridorWidthFt?: number
    wallInsetFt?: number
    obstacles?: Rect[]
  }
): { placed: PlacedBoothState[]; unplaced: string[]; route: Point[] } {
  const aisleFt = options.aisleFt
  const stepFt = options.stepFt
  const corridorWidthFt = options.corridorWidthFt ?? DEFAULT_CORRIDOR_WIDTH_FT
  const wallInsetFt = options.wallInsetFt ?? DEFAULT_WALL_INSET_FT
  const obstacles = options.obstacles ?? []
  const depth = maxBoothDepth(request.booths)

  const aisle = buildSerpentineAisle(
    request.room,
    request.entrance,
    request.exit,
    depth,
    corridorWidthFt,
    wallInsetFt
  )
  const route = aisle.centerline
  const aisleSlots = buildAisleSlots(route, corridorWidthFt, depth, aisleFt)

  const booths = [...request.booths].sort(
    (a, b) => b.width * b.height - a.width * a.height
  )
  const placed: PlacedBoothState[] = []
  const unplaced: string[] = []

  for (const booth of booths) {
    const slotCandidates = aisleSlots.map((s) => ({
      x: s.x,
      y: s.y,
      rotation: s.rotation,
    }))
    const gridCandidates = gridScanCandidates(request, stepFt, wallInsetFt)

    const state =
      tryPlaceBooth(
        booth,
        slotCandidates,
        request,
        aisleFt,
        obstacles,
        placed
      ) ??
      tryPlaceBooth(
        booth,
        gridCandidates,
        request,
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

/** Greedily accept traffic-aware seed placements that satisfy polygon constraints. */
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
  obstacles: Rect[]
): { placed: PlacedBoothState[]; unplaced: string[] } {
  const byId = new Map(booths.map((b) => [b.id, b]))
  const placed: PlacedBoothState[] = []
  const unplaced: string[] = []

  for (const p of trafficPlaced) {
    const booth = byId.get(p.id)
    if (!booth) continue
    if (
      placementIsValid(
        p.x,
        p.y,
        booth,
        p.rotation,
        request.room,
        aisleFt,
        obstacles,
        placed
      )
    ) {
      placed.push({ booth, x: p.x, y: p.y, rotation: p.rotation })
    } else {
      unplaced.push(p.id)
    }
  }

  for (const b of booths) {
    if (!placed.some((p) => p.booth.id === b.id) && !unplaced.includes(b.id)) {
      unplaced.push(b.id)
    }
  }

  return { placed, unplaced }
}
