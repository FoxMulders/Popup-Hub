import {
  BOOTH_VIEWING_DISTANCE_FT,
  DEFAULT_ATTENDEE_COUNT,
} from '@/lib/vendor-fairness-layout/constants'
import type { Booth, Point } from '../types'

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

export interface PlacedBoothState {
  booth: Booth
  x: number
  y: number
  rotation: number
}

export interface ExposureSimOptions {
  attendeeCount?: number
  /** Lateral jitter (ft) applied to patron positions along the route. */
  randomnessFt?: number
  /** Deterministic seed for patron jitter (optional). */
  randomSeed?: number
}

export interface ExposureSimResult {
  /** Normalized 0–100 percentages — pass-bys / attendeeCount × 100. */
  exposurePercentages: Map<string, number>
  passBys: Map<string, number>
  /** Legacy alias — same as exposurePercentages for scoring. */
  scores: Map<string, number>
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function samplePatronOnRoute(
  route: Point[],
  routeLen: number,
  t: number,
  randomnessFt: number,
  rng: () => number
): Point {
  const target = t * routeLen
  let acc = 0
  let patron: Point = route[0]!
  let segIdx = 0

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (acc + seg >= target) {
      const u = seg > 0 ? (target - acc) / seg : 0
      patron = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
      segIdx = i
      break
    }
    acc += seg
  }

  if (randomnessFt <= 0) return patron

  const a = route[segIdx]!
  const b = route[Math.min(segIdx + 1, route.length - 1)]!
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const along = (rng() * 2 - 1) * randomnessFt
  const lateral = (rng() * 2 - 1) * randomnessFt
  return {
    x: patron.x + (dx / len) * along + nx * lateral,
    y: patron.y + (dy / len) * along + ny * lateral,
  }
}

/**
 * Simulate patrons walking the PathfindingService route.
 * boothExposure = percentage of patrons passing within visibility distance.
 */
export function simulateExposure(
  route: Point[],
  placed: PlacedBoothState[],
  options: ExposureSimOptions = {}
): ExposureSimResult {
  const attendeeCount = options.attendeeCount ?? DEFAULT_ATTENDEE_COUNT
  const randomnessFt = options.randomnessFt ?? 0.75
  const rng =
    options.randomSeed != null
      ? mulberry32(options.randomSeed)
      : Math.random

  const passBys = new Map<string, number>()
  const exposurePercentages = new Map<string, number>()
  const scores = new Map<string, number>()

  for (const p of placed) {
    passBys.set(p.booth.id, 0)
    exposurePercentages.set(p.booth.id, 0)
    scores.set(p.booth.id, 0)
  }

  if (route.length < 2 || placed.length === 0) {
    return { exposurePercentages, passBys, scores }
  }

  let routeLen = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    routeLen += Math.hypot(b.x - a.x, b.y - a.y)
  }
  if (routeLen < 1e-6) return { exposurePercentages, passBys, scores }

  for (let s = 0; s < attendeeCount; s++) {
    const t = (s + 0.5) / attendeeCount
    const patron = samplePatronOnRoute(route, routeLen, t, randomnessFt, rng)

    for (const p of placed) {
      const facade = boothFacadeCenter(p.x, p.y, p.booth, p.rotation)
      const dist = Math.hypot(patron.x - facade.x, patron.y - facade.y)
      if (dist <= BOOTH_VIEWING_DISTANCE_FT + 2) {
        passBys.set(p.booth.id, (passBys.get(p.booth.id) ?? 0) + 1)
      }
    }
  }

  for (const p of placed) {
    const pct = ((passBys.get(p.booth.id) ?? 0) / attendeeCount) * 100
    exposurePercentages.set(p.booth.id, pct)
    scores.set(p.booth.id, pct)
  }

  return { exposurePercentages, passBys, scores }
}

export function exposureScoresFromPlacements(
  route: Point[],
  placed: PlacedBoothState[],
  attendeeCount = DEFAULT_ATTENDEE_COUNT,
  options?: Omit<ExposureSimOptions, 'attendeeCount'>
): Map<string, number> {
  return simulateExposure(route, placed, { ...options, attendeeCount }).scores
}

/** Distance from booth facade to nearest route segment (used for seed placement only). */
export function meanExposureDistance(
  x: number,
  y: number,
  booth: Booth,
  route: Point[],
  rotation = 0
): number {
  const facade = boothFacadeCenter(x, y, booth, rotation)
  return distToRoute(facade.x, facade.y, route)
}
