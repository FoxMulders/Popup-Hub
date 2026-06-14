import {
  BOOTH_VIEWING_DISTANCE_FT,
  DEFAULT_ATTENDEE_COUNT,
  VISIBILITY_CONE_DEG,
} from '../constants'
import type { Entrance, Exit, ExposureMetrics, Point, RotatedBooth } from '../types'
import { boothCenter, boothCorners, rotatedAabb } from '../geometry/booth-rect'
import { euclidean } from '../graph/build-graph'

/** Deterministic PRNG (mulberry32) for reproducible simulations. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function distanceAlongRoute(route: Point[], p: Point): number {
  let best = Infinity
  let cum = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!
    const b = route[i + 1]!
    const segLen = euclidean(a, b)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = Math.hypot(p.x - px, p.y - py)
    if (d < best) best = d
    cum += segLen * t
  }
  return cum + best * 0.01
}

function visibilityFromRoute(booth: RotatedBooth, attendeePos: Point, routeTangent: Point): number {
  const center = boothCenter(booth)
  const dist = euclidean(attendeePos, center)
  if (dist > BOOTH_VIEWING_DISTANCE_FT * 2) return 0
  const toBooth = { x: center.x - attendeePos.x, y: center.y - attendeePos.y }
  const len = Math.hypot(toBooth.x, toBooth.y) || 1
  toBooth.x /= len
  toBooth.y /= len
  const tLen = Math.hypot(routeTangent.x, routeTangent.y) || 1
  const tx = routeTangent.x / tLen
  const ty = routeTangent.y / tLen
  const dot = toBooth.x * tx + toBooth.y * ty
  const halfCone = (VISIBILITY_CONE_DEG / 2) * (Math.PI / 180)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
  if (angle > halfCone) return 0.1
  const distFactor = Math.max(0, 1 - dist / (BOOTH_VIEWING_DISTANCE_FT * 2))
  return distFactor
}

function neighborCount(booth: RotatedBooth, all: RotatedBooth[]): number {
  const aabb = rotatedAabb(booth)
  let count = 0
  for (const other of all) {
    if (other.id === booth.id) continue
    const o = rotatedAabb(other)
    const gap = Math.max(
      Math.max(o.x - (aabb.x + aabb.width), aabb.x - (o.x + o.width)),
      Math.max(o.y - (aabb.y + aabb.height), aabb.y - (o.y + o.height))
    )
    if (gap < 15) count++
  }
  return count
}

function routeTangentAt(route: Point[], t: number): Point {
  const idx = Math.min(Math.floor(t * (route.length - 1)), route.length - 2)
  const a = route[idx]!
  const b = route[idx + 1]!
  return { x: b.x - a.x, y: b.y - a.y }
}

export interface ExposureSimInput {
  booths: RotatedBooth[]
  route: Point[]
  entrance: Entrance
  exit: Exit
  attendeeCount?: number
  seed?: number
}

export function simulateExposure(input: ExposureSimInput): ExposureMetrics[] {
  const {
    booths,
    route,
    entrance,
    exit,
    attendeeCount = DEFAULT_ATTENDEE_COUNT,
    seed = 42,
  } = input
  const rand = mulberry32(seed)
  const metrics = new Map<string, ExposureMetrics>()
  for (const b of booths) {
    metrics.set(b.id, {
      boothId: b.id,
      impressions: 0,
      passBys: 0,
      visitLikelihood: 0,
      score: 0,
    })
  }

  if (route.length < 2 || booths.length === 0) return [...metrics.values()]

  const routeLen = route.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + euclidean(route[i - 1]!, p)),
    0
  )

  for (let a = 0; a < attendeeCount; a++) {
    let t = 0
    const stopChance = 0.15
    while (t < 1) {
      const pos = interpolateRoute(route, t)
      const tangent = routeTangentAt(route, t)
      for (const booth of booths) {
        const m = metrics.get(booth.id)!
        const vis = visibilityFromRoute(booth, pos, tangent)
        if (vis <= 0) continue
        m.passBys += vis * 0.1
        if (vis > 0.3) m.impressions += vis
        if (vis > 0.5 && rand() < stopChance * vis) {
          m.visitLikelihood += 1
        }
      }
      t += 0.02 + rand() * 0.03
    }
  }

  const entrancePt = { x: entrance.x, y: entrance.y }
  const exitPt = { x: exit.x, y: exit.y }

  for (const booth of booths) {
    const m = metrics.get(booth.id)!
    const center = boothCenter(booth)
    const routePos = distanceAlongRoute(route, center) / (routeLen || 1)
    const entDist = euclidean(center, entrancePt)
    const exitDist = euclidean(center, exitPt)
    const entFactor = Math.max(0, 1 - entDist / (routeLen || 100))
    const exitFactor = Math.max(0, 1 - exitDist / (routeLen || 100))
    const routeFactor = 1 - Math.abs(routePos - 0.5) * 0.5
    const neighbors = neighborCount(booth, booths)
    const neighborPenalty = Math.max(0, 1 - neighbors * 0.05)

    const raw =
      m.impressions * 0.35 +
      m.passBys * 0.2 +
      m.visitLikelihood * 0.25 +
      entFactor * 0.08 +
      exitFactor * 0.05 +
      routeFactor * 0.07
    m.score = raw * neighborPenalty
  }

  const maxScore = Math.max(...[...metrics.values()].map((m) => m.score), 1e-6)
  for (const m of metrics.values()) {
    m.score /= maxScore
  }

  return [...metrics.values()]
}

function interpolateRoute(route: Point[], t: number): Point {
  const total = route.length - 1
  const f = t * total
  const i = Math.floor(f)
  const frac = f - i
  if (i >= total) return { ...route[total]! }
  const a = route[i]!
  const b = route[i + 1]!
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }
}

export function exposureScoresMap(metrics: ExposureMetrics[]): Map<string, number> {
  return new Map(metrics.map((m) => [m.boothId, m.score]))
}
