import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  DEFAULT_AISLE_FT,
  DEFAULT_ATTENDEE_COUNT,
  DEFAULT_TIME_BUDGET_MS,
} from '@/lib/vendor-fairness-layout/constants'
import type { LayoutRequest, Point, Room } from '../types'
import {
  exposureScoresFromPlacements,
  type PlacedBoothState,
} from './exposure-simulator'
import { evaluateFairness } from './fairness-scorer'
import { computeRouteCoverage } from './route-coverage'
import {
  placementIsValid,
  validateAllPlacements,
} from './placement-validator'

export interface AnnealingState {
  placed: PlacedBoothState[]
  fairnessScore: number
}

function cloneState(placed: PlacedBoothState[]): PlacedBoothState[] {
  return placed.map((p) => ({ ...p, booth: { ...p.booth } }))
}

function scoreExposureOnRoute(
  route: Point[],
  placed: PlacedBoothState[],
  coveragePercentage: number,
  fast: boolean
): number {
  if (route.length < 2) return -1000
  const attendeeCount = fast ? 250 : DEFAULT_ATTENDEE_COUNT
  const scores = exposureScoresFromPlacements(route, placed, attendeeCount, {
    randomnessFt: fast ? 0.5 : 0.75,
    randomSeed: fast ? 42 : undefined,
  })
  return evaluateFairness(scores, coveragePercentage).fairnessScore
}

function trySwap(
  placed: PlacedBoothState[],
  i: number,
  j: number,
  room: Room,
  aisleFt: number,
  obstacles: Rect[]
): PlacedBoothState[] | null {
  if (i === j) return null
  const a = placed[i]!
  const b = placed[j]!
  const next = cloneState(placed)
  next[i] = { booth: a.booth, x: b.x, y: b.y, rotation: b.rotation }
  next[j] = { booth: b.booth, x: a.x, y: a.y, rotation: a.rotation }
  if (!validateAllPlacements(next, room, aisleFt, obstacles)) return null
  return next
}

function tryNudge(
  placed: PlacedBoothState[],
  idx: number,
  dx: number,
  dy: number,
  room: Room,
  aisleFt: number,
  obstacles: Rect[],
  stepFt: number
): PlacedBoothState[] | null {
  const cur = placed[idx]!
  const nx = cur.x + dx * stepFt
  const ny = cur.y + dy * stepFt
  const others = placed.filter((_, i) => i !== idx)
  if (
    !placementIsValid(
      nx,
      ny,
      cur.booth,
      cur.rotation,
      room,
      aisleFt,
      obstacles,
      others
    )
  ) {
    return null
  }
  const next = cloneState(placed)
  next[idx] = { ...cur, x: nx, y: ny }
  return next
}

function tryRotate(
  placed: PlacedBoothState[],
  idx: number,
  room: Room,
  aisleFt: number,
  obstacles: Rect[]
): PlacedBoothState[] | null {
  const cur = placed[idx]!
  const nextRot = (cur.rotation + 90) % 360
  const others = placed.filter((_, i) => i !== idx)
  if (
    !placementIsValid(
      cur.x,
      cur.y,
      cur.booth,
      nextRot,
      room,
      aisleFt,
      obstacles,
      others
    )
  ) {
    return null
  }
  const next = cloneState(placed)
  next[idx] = { ...cur, rotation: nextRot }
  return next
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

/**
 * Improve exposure equity via simulated annealing (swap, nudge, rotate).
 * Requires 100% PathfindingService route coverage before starting.
 */
export function optimizeFairnessAnnealing(
  initial: PlacedBoothState[],
  request: LayoutRequest,
  room: Room,
  options: {
    aisleFt?: number
    stepFt?: number
    obstacles?: Rect[]
    timeBudgetMs?: number
    randomSeed?: number
  } = {}
): AnnealingState {
  const aisleFt = options.aisleFt ?? DEFAULT_AISLE_FT
  const stepFt = options.stepFt ?? 0.5
  const obstacles = options.obstacles ?? []
  const deadline =
    Date.now() +
    (options.timeBudgetMs ??
      Math.min(12_000, DEFAULT_TIME_BUDGET_MS + initial.length * 120))
  const random =
    options.randomSeed != null ? mulberry32(options.randomSeed) : Math.random

  if (!validateAllPlacements(initial, room, aisleFt, obstacles)) {
    return { placed: [], fairnessScore: 0 }
  }

  const initialCoverage = computeRouteCoverage(request, initial)
  if (!initialCoverage.isFullCoverage) {
    return { placed: cloneState(initial), fairnessScore: 0 }
  }

  let current = cloneState(initial)
  const activeRoute = initialCoverage.route
  const activeCoveragePct = initialCoverage.coveragePercentage
  let currentScore = scoreExposureOnRoute(
    activeRoute,
    current,
    activeCoveragePct,
    true
  )
  let best = cloneState(current)
  let bestFairness = currentScore

  let temperature = Math.max(8, 18 - initial.length * 0.15)
  const cooling = 0.9975
  const nudgeDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
  ]

  while (Date.now() < deadline && temperature > 0.15) {
    const moveKind = random()
    let candidate: PlacedBoothState[] | null = null
    const stride = temperature > 4 ? 2 : 1

    if (moveKind < 0.4 && current.length >= 2) {
      const i = Math.floor(random() * current.length)
      let j = Math.floor(random() * current.length)
      if (j === i) j = (j + 1) % current.length
      candidate = trySwap(current, i, j, room, aisleFt, obstacles)
    } else if (moveKind < 0.72 && current.length > 0) {
      const idx = Math.floor(random() * current.length)
      const dir = nudgeDirs[Math.floor(random() * nudgeDirs.length)]!
      candidate = tryNudge(
        current,
        idx,
        dir.dx,
        dir.dy,
        room,
        aisleFt,
        obstacles,
        stepFt * stride
      )
    } else if (current.length > 0) {
      const idx = Math.floor(random() * current.length)
      candidate = tryRotate(current, idx, room, aisleFt, obstacles)
    }

    if (!candidate) {
      temperature *= cooling
      continue
    }

    const candidateScore = scoreExposureOnRoute(
      activeRoute,
      candidate,
      activeCoveragePct,
      true
    )
    const delta = candidateScore - currentScore
    const accept =
      delta > 0 ||
      random() < Math.exp(delta / Math.max(temperature, 0.01))

    if (accept) {
      current = candidate
      currentScore = candidateScore
      if (candidateScore > bestFairness) {
        best = cloneState(current)
        bestFairness = candidateScore
      }
    }

    temperature *= cooling
  }

  return { placed: best, fairnessScore: bestFairness }
}

export function seedPlacementsFromTraffic(
  trafficPlaced: Array<{
    id: string
    x: number
    y: number
    rotation: number
  }>,
  booths: import('../types').Booth[]
): PlacedBoothState[] {
  const byId = new Map(booths.map((b) => [b.id, b]))
  return trafficPlaced
    .map((p) => {
      const booth = byId.get(p.id)
      if (!booth) return null
      return {
        booth,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
      }
    })
    .filter((p): p is PlacedBoothState => p != null)
}
