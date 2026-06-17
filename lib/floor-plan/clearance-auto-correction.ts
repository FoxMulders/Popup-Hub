/**
 * Push-back and prune routines — lift every vendor booth to green (≥4′) clearance.
 */

import {
  BOOTH_CLEARANCE_GOOD_FT,
  clearanceBand,
  edgeClearanceBetweenRects,
  minVendorBoothClearanceFt,
} from '@/lib/coordinator/booth-clearance-visual'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  placedObjectsOverlap,
  rotatedAabb,
  type Rect,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

const MAX_PUSH_ITERATIONS = 48
const MAX_PRUNE_ROUNDS = 64
const POSITION_EPS = 0.25

export interface ClearanceCorrectionResult {
  doc: FloorPlanDoc
  prunedIds: string[]
  pushBackIterations: number
  pruneRounds: number
  allGreen: boolean
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function boothPlacementRect(booth: BoothObject): Rect {
  return rotatedAabb(booth)
}

function vendorBoothsInDoc(doc: FloorPlanDoc, roomId?: string): BoothObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter((o): o is BoothObject => {
    if (o.kind !== 'booth' || isGuestTableBooth(o) || !isVendorBoothObject(o)) {
      return false
    }
    if (roomId == null) return true
    return objectRoom[o.id] === roomId
  })
}

function prunePriority(booth: BoothObject, minFt: number): number {
  let score = minFt
  if (!booth.vendorId) score -= 100
  if (!booth.categoryName) score -= 50
  if (!booth.label?.trim()) score -= 10
  return score
}

function overlapContext(doc: FloorPlanDoc) {
  return {
    canvasWidthFt: doc.canvasWidthFt,
    canvasLengthFt: doc.canvasLengthFt,
    gridSpacingFt: doc.gridSpacingFt,
    snapFt: doc.snapFt,
    objects: doc.objects,
    rooms: doc.rooms ?? [],
    objectRoom: doc.objectRoom,
  }
}

function boothMinClearance(
  booth: BoothObject,
  doc: FloorPlanDoc
): { minFt: number; band: ReturnType<typeof clearanceBand> } {
  const minFt = minVendorBoothClearanceFt(
    booth,
    doc.objects,
    doc.rooms,
    doc.objectRoom
  )
  return { minFt, band: clearanceBand(minFt) }
}

function worstVendorBooth(
  booths: BoothObject[],
  doc: FloorPlanDoc
): { booth: BoothObject; minFt: number } | null {
  let worst: { booth: BoothObject; minFt: number } | null = null
  for (const booth of booths) {
    const { minFt, band } = boothMinClearance(booth, doc)
    if (band === 'good') continue
    if (!worst || minFt < worst.minFt) {
      worst = { booth, minFt }
    }
  }
  return worst
}

function pushVectorForRects(
  moving: Rect,
  blocker: Rect,
  targetGapFt: number
): { dx: number; dy: number } | null {
  const gap = edgeClearanceBetweenRects(moving, blocker)
  const needed = targetGapFt - gap
  if (needed <= 1e-6) return null

  const overlapX =
    Math.min(moving.x + moving.width, blocker.x + blocker.width) -
    Math.max(moving.x, blocker.x)
  const overlapY =
    Math.min(moving.y + moving.height, blocker.y + blocker.height) -
    Math.max(moving.y, blocker.y)

  if (overlapX > 0 && overlapY > 0) {
    if (overlapX <= overlapY) {
      const dir =
        moving.x + moving.width / 2 < blocker.x + blocker.width / 2 ? -1 : 1
      return { dx: dir * (needed + overlapX * 0.5), dy: 0 }
    }
    const dir =
      moving.y + moving.height / 2 < blocker.y + blocker.height / 2 ? -1 : 1
    return { dx: 0, dy: dir * (needed + overlapY * 0.5) }
  }

  const gapLeft = moving.x - (blocker.x + blocker.width)
  const gapRight = blocker.x - (moving.x + moving.width)
  const gapTop = moving.y - (blocker.y + blocker.height)
  const gapBottom = blocker.y - (moving.y + moving.height)

  const candidates: Array<{ axis: 'x' | 'y'; dir: number; mag: number }> = []
  if (gapLeft >= 0) candidates.push({ axis: 'x', dir: -1, mag: gapLeft })
  if (gapRight >= 0) candidates.push({ axis: 'x', dir: 1, mag: gapRight })
  if (gapTop >= 0) candidates.push({ axis: 'y', dir: -1, mag: gapTop })
  if (gapBottom >= 0) candidates.push({ axis: 'y', dir: 1, mag: gapBottom })

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.mag - b.mag)
  const best = candidates[0]!
  const delta = needed + 0.25
  return best.axis === 'x'
    ? { dx: best.dir * delta, dy: 0 }
    : { dx: 0, dy: best.dir * delta }
}

function nearestConstraintVector(
  booth: BoothObject,
  doc: FloorPlanDoc,
  targetGapFt: number
): { dx: number; dy: number } | null {
  const selfRect = boothPlacementRect(booth)
  let bestVec: { dx: number; dy: number } | null = null
  let bestGap = Number.POSITIVE_INFINITY

  for (const other of doc.objects) {
    if (other.id === booth.id) continue
    if (other.kind === 'booth') {
      if (!isVendorBoothObject(other as BoothObject)) continue
    }
    const otherRect = rotatedAabb(other)
    const gap = edgeClearanceBetweenRects(selfRect, otherRect)
    if (gap >= targetGapFt) continue
    if (gap >= bestGap) continue
    const vec = pushVectorForRects(selfRect, otherRect, targetGapFt)
    if (vec) {
      bestGap = gap
      bestVec = vec
    }
  }

  return bestVec
}

function tryPushBooth(
  booth: BoothObject,
  doc: FloorPlanDoc,
  targetGapFt: number
): BoothObject | null {
  const vec = nearestConstraintVector(booth, doc, targetGapFt)
  if (!vec) return null

  const candidate: BoothObject = {
    ...booth,
    x: roundHalf(booth.x + vec.dx),
    y: roundHalf(booth.y + vec.dy),
  }

  const ctx = overlapContext(doc)
  for (const other of doc.objects) {
    if (other.id === booth.id) continue
    if (placedObjectsOverlap(candidate, other, ctx)) {
      return null
    }
  }

  const { band } = boothMinClearance(candidate, {
    ...doc,
    objects: doc.objects.map((o) => (o.id === booth.id ? candidate : o)),
  })
  if (band === 'critical' && clearanceBand(boothMinClearance(booth, doc).minFt) === 'critical') {
    return null
  }

  return candidate
}

function replaceBoothInDoc(doc: FloorPlanDoc, next: BoothObject): FloorPlanDoc {
  return {
    ...doc,
    objects: doc.objects.map((o) => (o.id === next.id ? next : o)),
  }
}

function removeBoothFromDoc(doc: FloorPlanDoc, boothId: string): FloorPlanDoc {
  return {
    ...doc,
    objects: doc.objects.filter((o) => o.id !== boothId),
  }
}

/**
 * Iteratively push vendor booths apart, then prune lowest-priority booths until
 * every remaining vendor booth achieves green (≥4′) clearance on all edges.
 */
export function applyClearanceAutoCorrection(
  doc: FloorPlanDoc,
  options: { roomId?: string; targetClearanceFt?: number } = {}
): ClearanceCorrectionResult {
  const targetFt = options.targetClearanceFt ?? BOOTH_CLEARANCE_GOOD_FT
  let working = doc
  let pushBackIterations = 0
  let pruneRounds = 0
  const prunedIds: string[] = []

  for (let pushRound = 0; pushRound < MAX_PUSH_ITERATIONS; pushRound++) {
    const vendors = vendorBoothsInDoc(working, options.roomId)
    const worst = worstVendorBooth(vendors, working)
    if (!worst) break

    const pushed = tryPushBooth(worst.booth, working, targetFt)
    if (!pushed) break
    working = replaceBoothInDoc(working, pushed)
    pushBackIterations++
  }

  for (let pruneRound = 0; pruneRound < MAX_PRUNE_ROUNDS; pruneRound++) {
    const vendors = vendorBoothsInDoc(working, options.roomId)
    const violating = vendors
      .map((booth) => ({
        booth,
        ...boothMinClearance(booth, working),
      }))
      .filter((v) => v.band !== 'good')

    if (violating.length === 0) break

    violating.sort(
      (a, b) => prunePriority(a.booth, a.minFt) - prunePriority(b.booth, b.minFt)
    )
    const victim = violating[0]!.booth
    working = removeBoothFromDoc(working, victim.id)
    prunedIds.push(victim.id)
    pruneRounds++
  }

  const remaining = vendorBoothsInDoc(working, options.roomId)
  const allGreen =
    remaining.length === 0 ||
    remaining.every(
      (b) => boothMinClearance(b, working).band === 'good'
    )

  return {
    doc: working,
    prunedIds,
    pushBackIterations,
    pruneRounds,
    allGreen,
  }
}

/** Count vendor booths in green clearance band. */
export function countGreenVendorBooths(
  doc: FloorPlanDoc,
  roomId?: string
): { green: number; total: number } {
  const vendors = vendorBoothsInDoc(doc, roomId)
  let green = 0
  for (const booth of vendors) {
    if (boothMinClearance(booth, doc).band === 'good') green++
  }
  return { green, total: vendors.length }
}
