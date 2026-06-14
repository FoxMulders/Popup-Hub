import {
  BOOTH_VIEWING_DISTANCE_FT,
  DEFAULT_ATTENDEE_COUNT,
  VISIBILITY_CONE_DEG,
} from '@/lib/vendor-fairness-layout/constants'
import type { Booth, Point } from '../types'
import { boothFootprintRect } from './placement-validator'

const HALF_VISION_COS = Math.cos((VISIBILITY_CONE_DEG / 2) * (Math.PI / 180))

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

function distToRoute(px: number, py: number, route: Point[]): number {
  let best = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    best = Math.min(best, distPointToSegment(px, py, a.x, a.y, b.x, b.y))
  }
  return best
}

function routeTangentAt(
  px: number,
  py: number,
  route: Point[]
): { x: number; y: number } {
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    const d = distPointToSegment(px, py, a.x, a.y, b.x, b.y)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  const a = route[bestIdx]!
  const b = route[Math.min(bestIdx + 1, route.length - 1)]!
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
}

function boothFacadeCenter(
  x: number,
  y: number,
  booth: Booth,
  rotation: number
): Point {
  const cx = x + booth.width / 2
  const cy = y + booth.height / 2
  const rad = (rotation * Math.PI) / 180
  return {
    x: cx + Math.sin(rad) * (booth.height * 0.5),
    y: cy - Math.cos(rad) * (booth.height * 0.5),
  }
}

function visibleFromPatron(
  patron: Point,
  facade: Point,
  route: Point[]
): boolean {
  const dist = Math.hypot(patron.x - facade.x, patron.y - facade.y)
  if (dist > BOOTH_VIEWING_DISTANCE_FT) return false
  const tangent = routeTangentAt(patron.x, patron.y, route)
  const toFacade = {
    x: facade.x - patron.x,
    y: facade.y - patron.y,
  }
  const len = Math.hypot(toFacade.x, toFacade.y) || 1
  toFacade.x /= len
  toFacade.y /= len
  const dot = tangent.x * toFacade.x + tangent.y * toFacade.y
  return dot >= HALF_VISION_COS
}

export interface PlacedBoothState {
  booth: Booth
  x: number
  y: number
  rotation: number
}

export interface ExposureSimResult {
  scores: Map<string, number>
  impressions: Map<string, number>
  passBys: Map<string, number>
}

/** Sample virtual attendees along the route and score booth visibility. */
export function simulateExposure(
  route: Point[],
  placed: PlacedBoothState[],
  attendeeCount = DEFAULT_ATTENDEE_COUNT
): ExposureSimResult {
  const impressions = new Map<string, number>()
  const passBys = new Map<string, number>()
  const scores = new Map<string, number>()

  for (const p of placed) {
    impressions.set(p.booth.id, 0)
    passBys.set(p.booth.id, 0)
  }

  if (route.length < 2 || placed.length === 0) {
    return { scores, impressions, passBys }
  }

  let routeLen = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    routeLen += Math.hypot(b.x - a.x, b.y - a.y)
  }
  if (routeLen < 1e-6) return { scores, impressions, passBys }

  for (let s = 0; s < attendeeCount; s++) {
    const t = (s + 0.5) / attendeeCount
    const target = t * routeLen
    let acc = 0
    let patron: Point = route[0]!
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!
      const b = route[i + 1]!
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (acc + seg >= target) {
        const u = seg > 0 ? (target - acc) / seg : 0
        patron = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
        break
      }
      acc += seg
    }

    for (const p of placed) {
      const facade = boothFacadeCenter(p.x, p.y, p.booth, p.rotation)
      const dist = distToRoute(facade.x, facade.y, route)
      if (dist <= BOOTH_VIEWING_DISTANCE_FT + 2) {
        passBys.set(p.booth.id, (passBys.get(p.booth.id) ?? 0) + 1)
      }
      if (visibleFromPatron(patron, facade, route)) {
        impressions.set(
          p.booth.id,
          (impressions.get(p.booth.id) ?? 0) + 1
        )
      }
    }
  }

  const maxImp = Math.max(1, ...impressions.values())
  for (const p of placed) {
    scores.set(p.booth.id, (impressions.get(p.booth.id) ?? 0) / maxImp)
  }

  return { scores, impressions, passBys }
}

export function exposureScoresFromPlacements(
  route: Point[],
  placed: PlacedBoothState[]
): Map<string, number> {
  return simulateExposure(route, placed).scores
}

export function meanExposureDistance(
  x: number,
  y: number,
  booth: Booth,
  route: Point[]
): number {
  const facade = boothFacadeCenter(x, y, booth, 0)
  return distToRoute(facade.x, facade.y, route)
}

export { boothFootprintRect, boothFacadeCenter }
