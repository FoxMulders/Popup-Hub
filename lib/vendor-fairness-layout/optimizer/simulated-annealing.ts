import {
  DEFAULT_AISLE_FT,
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_WALL_INSET_FT,
} from '../constants'
import type { AisleSkeleton, Booth, Entrance, Exit, Point, Room, RotatedBooth } from '../types'
import {
  anyBoothOverlap,
  buildSerpentineAisle,
  maxBoothDepth,
  roomBoundingBox,
  validateBoothInRoom,
} from '../geometry'
import { simulateExposure } from '../exposure'
import { generateRoute } from '../route'
import { exposureVariance } from '../scoring'
import { mulberry32 } from '../exposure/simulator'

export interface SeedLayoutResult {
  booths: RotatedBooth[]
  aisle: AisleSkeleton
}

/** Initial grid placement along serpentine aisle margins. */
export function seedLayout(
  room: Room,
  booths: Booth[],
  entrance: Entrance,
  exit: Exit,
  aisleFt = DEFAULT_AISLE_FT,
  corridorWidthFt = DEFAULT_CORRIDOR_WIDTH_FT,
  wallInsetFt = DEFAULT_WALL_INSET_FT
): SeedLayoutResult {
  const depth = maxBoothDepth(booths)
  const aisle = buildSerpentineAisle(room, entrance, exit, depth, corridorWidthFt, wallInsetFt)
  const bbox = roomBoundingBox(room.boundary)
  const placed: RotatedBooth[] = []

  const slots: Array<{ x: number; y: number; rotation: number }> = []
  for (let i = 0; i < aisle.centerline.length - 1; i++) {
    const a = aisle.centerline[i]!
    const b = aisle.centerline[i + 1]!
    const tangent = Math.atan2(b.y - a.y, b.x - a.x)
    const rot = (tangent * 180) / Math.PI
    const normal = { x: -Math.sin(tangent), y: Math.cos(tangent) }
    const offset = corridorWidthFt / 2 + depth / 2 + aisleFt
    slots.push({
      x: a.x + normal.x * offset - depth / 2,
      y: a.y + normal.y * offset - depth / 2,
      rotation: rot,
    })
    slots.push({
      x: a.x - normal.x * offset - depth / 2,
      y: a.y - normal.y * offset - depth / 2,
      rotation: rot + 180,
    })
  }

  const gridCols = Math.ceil(Math.sqrt(booths.length * 1.5))
  const avgW = booths.reduce((s, b) => s + b.width, 0) / (booths.length || 1)
  const avgH = booths.reduce((s, b) => s + b.height, 0) / (booths.length || 1)
  const pitchX = avgW + aisleFt
  const pitchY = avgH + aisleFt
  const startX = bbox.x + wallInsetFt
  const startY = bbox.y + wallInsetFt

  let slotIdx = 0
  for (let i = 0; i < booths.length; i++) {
    const booth = booths[i]!
    let x = startX + (i % gridCols) * pitchX
    let y = startY + Math.floor(i / gridCols) * pitchY
    let rotation = 0

    if (slotIdx < slots.length) {
      const slot = slots[slotIdx]!
      x = slot.x
      y = slot.y
      rotation = slot.rotation
      slotIdx++
    }

    const candidate: RotatedBooth = {
      id: booth.id,
      x,
      y,
      width: booth.width,
      height: booth.height,
      rotation: rotation % 360,
    }

    if (!validateBoothInRoom(candidate, room.boundary)) {
      candidate.x = startX + (i % gridCols) * pitchX
      candidate.y = startY + Math.floor(i / gridCols) * pitchY
      candidate.rotation = 0
    }

    placed.push(candidate)
  }

  return { booths: placed, aisle }
}

export interface OptimizerState {
  booths: RotatedBooth[]
  variance: number
  route: Point[]
}

export interface AnnealingOptions {
  room: Room
  entrance: Entrance
  exit: Exit
  aisle: AisleSkeleton
  timeBudgetMs?: number
  aisleFt?: number
  attendeeCount?: number
  seed?: number
}

export function optimizeLayout(
  initial: RotatedBooth[],
  options: AnnealingOptions
): OptimizerState {
  const {
    room,
    entrance,
    exit,
    aisle,
    timeBudgetMs = 1800,
    aisleFt = DEFAULT_AISLE_FT,
    attendeeCount = 500,
    seed = 42,
  } = options

  const rand = mulberry32(seed)
  let current = initial.map((b) => ({ ...b }))
  const bbox = roomBoundingBox(room.boundary)

  function evaluate(booths: RotatedBooth[], fullRoute = false): OptimizerState {
    const routeResult = fullRoute
      ? generateRoute(room, entrance, exit, booths, aisle)
      : { route: aisle.centerline }
    const exposure = simulateExposure({
      booths,
      route: routeResult.route,
      entrance,
      exit,
      attendeeCount: fullRoute ? attendeeCount : Math.min(200, attendeeCount),
      seed,
    })
    const variance = exposureVariance(exposure.map((e) => e.score))
    return { booths, variance, route: routeResult.route }
  }

  let best = evaluate(current, true)
  let currentState = best
  let temp = 1.0
  const start = performance.now()
  let iterations = 0

  while (performance.now() - start < timeBudgetMs) {
    iterations++
    const idx = Math.floor(rand() * current.length)
    const b = current[idx]!
    const mutated = current.map((booth, i) => {
      if (i !== idx) return { ...booth }
      const moveType = rand()
      let { x, y, rotation } = booth
      if (moveType < 0.5) {
        x += (rand() - 0.5) * 6
        y += (rand() - 0.5) * 6
      } else if (moveType < 0.85) {
        rotation = (rotation + (rand() > 0.5 ? 90 : -90) + 360) % 360
      } else {
        x += (rand() - 0.5) * 12
        y += (rand() - 0.5) * 12
      }
      x = Math.max(bbox.x, Math.min(bbox.x + bbox.width - booth.width, x))
      y = Math.max(bbox.y, Math.min(bbox.y + bbox.height - booth.height, y))
      return { ...booth, x, y, rotation }
    })

    if (!mutated.every((b) => validateBoothInRoom(b, room.boundary))) continue
    if (anyBoothOverlap(mutated, aisleFt)) continue

    const candidate = evaluate(mutated, false)
    const delta = candidate.variance - currentState.variance
    if (delta < 0 || rand() < Math.exp(-delta / temp)) {
      current = mutated
      currentState = candidate
      if (candidate.variance < best.variance) {
        best = candidate
      }
    }

    temp *= 0.9995
    if (temp < 0.001) temp = 0.5
  }

  return evaluate(best.booths, true)
}
