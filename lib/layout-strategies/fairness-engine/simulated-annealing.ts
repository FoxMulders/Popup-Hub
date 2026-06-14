import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  DEFAULT_AISLE_FT,
  DEFAULT_TIME_BUDGET_MS,
} from '@/lib/vendor-fairness-layout/constants'
import type { Booth, LayoutRequest, Point, Room } from '../types'
import {
  exposureScoresFromPlacements,
  type PlacedBoothState,
} from './exposure-simulator'
import { computeFairnessScore } from './fairness-scorer'
import { placementIsValid } from './placement-validator'

export interface AnnealingState {
  placed: PlacedBoothState[]
  fairnessScore: number
}

function cloneState(placed: PlacedBoothState[]): PlacedBoothState[] {
  return placed.map((p) => ({ ...p, booth: { ...p.booth } }))
}

function scoreState(route: Point[], placed: PlacedBoothState[]): number {
  const scores = exposureScoresFromPlacements(route, placed)
  return computeFairnessScore(scores)
}

function validateAllPlacements(
  placed: PlacedBoothState[],
  room: Room,
  aisleFt: number,
  obstacles: Rect[]
): boolean {
  for (let k = 0; k < placed.length; k++) {
    const cur = placed[k]!
    const others = placed.filter((_, idx) => idx !== k)
    if (
      !placementIsValid(
        cur.x,
        cur.y,
        cur.booth,
        cur.rotation,
        room,
        aisleFt,
        obstacles,
        others
      )
    ) {
      return false
    }
  }
  return true
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

/**
 * Improve exposure equity via simulated annealing (swap + nudge moves).
 */
export function optimizeFairnessAnnealing(
  initial: PlacedBoothState[],
  route: Point[],
  room: Room,
  options: {
    aisleFt?: number
    stepFt?: number
    obstacles?: Rect[]
    timeBudgetMs?: number
  } = {}
): AnnealingState {
  const aisleFt = options.aisleFt ?? DEFAULT_AISLE_FT
  const stepFt = options.stepFt ?? 0.5
  const obstacles = options.obstacles ?? []
  const deadline = Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS)

  let current = cloneState(initial)
  let currentScore = scoreState(route, current)
  let best = cloneState(current)
  let bestScore = currentScore

  let temperature = 12
  const cooling = 0.985
  const nudgeDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]

  while (Date.now() < deadline && temperature > 0.25) {
    const moveKind = Math.random()
    let candidate: PlacedBoothState[] | null = null

    if (moveKind < 0.55 && current.length >= 2) {
      const i = Math.floor(Math.random() * current.length)
      let j = Math.floor(Math.random() * current.length)
      if (j === i) j = (j + 1) % current.length
      candidate = trySwap(current, i, j, room, aisleFt, obstacles)
    } else if (current.length > 0) {
      const idx = Math.floor(Math.random() * current.length)
      const dir = nudgeDirs[Math.floor(Math.random() * nudgeDirs.length)]!
      candidate = tryNudge(
        current,
        idx,
        dir.dx,
        dir.dy,
        room,
        aisleFt,
        obstacles,
        stepFt
      )
    }

    if (!candidate) {
      temperature *= cooling
      continue
    }

    const candidateScore = scoreState(route, candidate)
    const delta = candidateScore - currentScore
    const accept =
      delta > 0 ||
      Math.random() < Math.exp(delta / Math.max(temperature, 0.01))

    if (accept) {
      current = candidate
      currentScore = candidateScore
      if (currentScore > bestScore) {
        best = cloneState(current)
        bestScore = currentScore
      }
    }

    temperature *= cooling
  }

  return { placed: best, fairnessScore: bestScore }
}

export function seedPlacementsFromTraffic(
  trafficPlaced: Array<{
    id: string
    x: number
    y: number
    rotation: number
  }>,
  booths: Booth[]
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
