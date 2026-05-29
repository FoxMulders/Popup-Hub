/**
 * Patron flow pathing — predictive sight-line corridors for booth
 * placement optimization during auto-arrange.
 *
 * Builds:
 *   - Primary vector: entrance door → emergency exit
 *   - Shortcut route: corner-biased interior path (Manhattan with
 *     diagonal corner cuts toward room centroid)
 *   - Patron Vision Matrix: 10′ wide corridor along both paths
 *
 * Used as a post-placement enhancement pass to swap booth positions
 * so high-demand categories gain primary-path exposure.
 */

import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { rotatedAabb } from '../interactions/geometry'

/** Width of the patron sight-line corridor in feet. */
export const PATRON_VISION_WIDTH_FT = 10

export interface Point2 {
  x: number
  y: number
}

export interface PatronFlowPaths {
  primary: Point2[]
  shortcut: Point2[]
  /** Axis-aligned rects approximating the 10′ vision band. */
  visionRects: Array<{ x: number; y: number; width: number; height: number }>
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function centerOf(obj: PlacedObject): Point2 {
  const aabb = rotatedAabb(obj)
  return {
    x: aabb.x + aabb.width / 2,
    y: aabb.y + aabb.height / 2,
  }
}

function findEntrance(doors: PlacedObject[]): PlacedObject | null {
  const entrance = doors.find(
    (d) => d.kind === 'door' && d.doorType === 'entrance'
  )
  return entrance ?? doors.find((d) => d.kind === 'door') ?? null
}

function findExit(objects: PlacedObject[]): PlacedObject | null {
  const emergency = objects.find((o) => o.kind === 'emergency_exit')
  if (emergency) return emergency
  const exitDoor = objects.find(
    (d) => d.kind === 'door' && d.doorType === 'exit'
  )
  return exitDoor ?? null
}

/** Manhattan path with one interior corner toward room center. */
function shortcutPath(
  start: Point2,
  end: Point2,
  roomCenter: Point2
): Point2[] {
  const corner: Point2 = {
    x: start.x + (roomCenter.x - start.x) * 0.65,
    y: end.y + (roomCenter.y - end.y) * 0.35,
  }
  return [start, corner, end]
}

function lerpPoints(a: Point2, b: Point2, steps: number): Point2[] {
  const out: Point2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    })
  }
  return out
}

function polylineToVisionRects(
  points: Point2[],
  halfWidth: number
): Rect[] {
  const rects: Rect[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) >= Math.abs(dy)) {
      rects.push({
        x: Math.min(a.x, b.x) - halfWidth,
        y: Math.min(a.y, b.y) - halfWidth,
        width: Math.abs(dx) + halfWidth * 2,
        height: halfWidth * 2,
      })
    } else {
      rects.push({
        x: Math.min(a.x, b.x) - halfWidth,
        y: Math.min(a.y, b.y) - halfWidth,
        width: halfWidth * 2,
        height: Math.abs(dy) + halfWidth * 2,
      })
    }
  }
  return rects
}

/**
 * Compute patron flow paths from door-in to exit for a room-local doc.
 * Returns null when entrance or exit fixtures are missing.
 */
export function computePatronFlowPaths(doc: FloorPlanDoc): PatronFlowPaths | null {
  const doors = doc.objects.filter((o) => o.kind === 'door')
  const entrance = findEntrance(doors)
  const exit = findExit(doc.objects)
  if (!entrance || !exit) return null

  const start = centerOf(entrance)
  const end = centerOf(exit)
  const roomCenter: Point2 = {
    x: doc.canvasWidthFt / 2,
    y: doc.canvasLengthFt / 2,
  }

  const primary = lerpPoints(start, end, 24)
  const shortcut = shortcutPath(start, end, roomCenter)
  const halfVision = PATRON_VISION_WIDTH_FT / 2
  const visionRects = [
    ...polylineToVisionRects(primary, halfVision),
    ...polylineToVisionRects(shortcut, halfVision),
  ]

  return { primary, shortcut, visionRects }
}

/** Distance from booth center to nearest vision rect edge (0 = inside). */
function exposureScore(
  booth: BoothObject,
  visionRects: Rect[]
): number {
  const cx = booth.x + booth.width / 2
  const cy = booth.y + booth.height / 2
  let best = Infinity
  for (const r of visionRects) {
    const inside =
      cx >= r.x &&
      cx <= r.x + r.width &&
      cy >= r.y &&
      cy <= r.y + r.height
    if (inside) return 0
    const dx = Math.max(r.x - cx, 0, cx - (r.x + r.width))
    const dy = Math.max(r.y - cy, 0, cy - (r.y + r.height))
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

function isHighDemandCategory(
  category: string | null | undefined,
  eventCategoryNames?: ReadonlyArray<string>
): boolean {
  if (!category || !eventCategoryNames?.length) return false
  const idx = eventCategoryNames.indexOf(category)
  return idx >= 0 && idx < Math.ceil(eventCategoryNames.length / 2)
}

/**
 * Re-order booth assignments so high-demand categories occupy slots
 * with the best patron-path exposure. Mutates booth positions by
 * swapping pairs when it improves weighted exposure.
 */
export function enhanceBoothsForPatronFlow(
  booths: BoothObject[],
  paths: PatronFlowPaths,
  eventCategoryNames?: ReadonlyArray<string>
): BoothObject[] {
  if (booths.length < 2) return booths

  const result = booths.map((b) => ({ ...b }))
  const maxPasses = Math.min(result.length * 2, 40)

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]!
        const b = result[j]!
        const scoreBefore =
          weightedExposure(a, paths.visionRects, eventCategoryNames) +
          weightedExposure(b, paths.visionRects, eventCategoryNames)
        const swappedA = { ...a, x: b.x, y: b.y }
        const swappedB = { ...b, x: a.x, y: a.y }
        const scoreAfter =
          weightedExposure(swappedA, paths.visionRects, eventCategoryNames) +
          weightedExposure(swappedB, paths.visionRects, eventCategoryNames)
        if (scoreAfter < scoreBefore - 0.01) {
          result[i] = swappedA
          result[j] = swappedB
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return result
}

function weightedExposure(
  booth: BoothObject,
  visionRects: Rect[],
  eventCategoryNames?: ReadonlyArray<string>
): number {
  const dist = exposureScore(booth, visionRects)
  const weight = isHighDemandCategory(booth.categoryName, eventCategoryNames)
    ? 0.35
    : 1
  return dist * weight
}
