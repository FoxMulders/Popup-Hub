import { DEFAULT_CORRIDOR_WIDTH_FT, DEFAULT_WALL_INSET_FT } from '../constants'
import type { AisleSkeleton, Booth, Entrance, Exit, Point, Room } from '../types'
import { boothCorners, rotatedAabb } from './booth-rect'
import {
  allPointsInRoom,
  horizontalSpanAtY,
  insetBoundary,
  pointInRoom,
  roomBoundingBox,
} from './polygon'

export type SerpentinePrimaryAxis = 'vertical' | 'horizontal'

const DOOR_MERGE_FT = 12

function resolveCirculationEndpoints(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  maxBoothDepth: number,
  wallInsetFt: number
): { start: Point; end: Point; appendExit: Point | null } {
  const start: Point = { x: entrance.x, y: entrance.y }
  const end: Point = { x: exit.x, y: exit.y }
  const doorSpan = Math.hypot(end.x - start.x, end.y - start.y)
  const inset = insetBoundary(room.boundary, wallInsetFt)
  const bbox = roomBoundingBox(inset)
  const sameWallBand = Math.abs(end.y - start.y) < maxBoothDepth + wallInsetFt

  if (doorSpan >= DOOR_MERGE_FT && !sameWallBand) {
    return { start, end, appendExit: null }
  }

  const midX = bbox.x + bbox.width / 2
  const nearBottom = start.y > bbox.y + bbox.height * 0.55
  const nearTop = start.y < bbox.y + bbox.height * 0.45
  const turnaround: Point = nearBottom
    ? { x: midX, y: bbox.y + maxBoothDepth }
    : nearTop
      ? { x: midX, y: bbox.y + bbox.height - maxBoothDepth }
      : start.x < midX
        ? { x: bbox.x + bbox.width - maxBoothDepth, y: bbox.y + bbox.height / 2 }
        : { x: bbox.x + maxBoothDepth, y: bbox.y + bbox.height / 2 }

  return { start, end: turnaround, appendExit: end }
}

export interface SerpentineAisleOptions {
  primaryAxis?: SerpentinePrimaryAxis
  reverseFlow?: boolean
}

function dedupeCenterlinePoints(points: Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.25) {
      out.push({ ...p })
    }
  }
  return out
}

function clipSerpentineCenterline(
  room: Room,
  start: Point,
  end: Point,
  centerline: Point[],
  corridorWidthFt: number
): AisleSkeleton {
  const inside = dedupeCenterlinePoints(
    centerline.filter((p) => pointInRoom(p, room.boundary))
  )
  if (inside.length >= 3) {
    return { centerline: inside, widthFt: corridorWidthFt }
  }

  const fallback: Point[] = [{ ...start }]
  for (let i = 1; i < centerline.length - 1; i++) {
    const p = centerline[i]!
    if (pointInRoom(p, room.boundary)) {
      fallback.push({ ...p })
    }
  }
  fallback.push({ ...end })

  const merged = dedupeCenterlinePoints(fallback)
  if (merged.length >= 2) {
    return { centerline: merged, widthFt: corridorWidthFt }
  }
  return { centerline: [start, end], widthFt: corridorWidthFt }
}

function spanAtY(
  room: Room,
  y: number,
  wallInsetFt: number,
  bbox: ReturnType<typeof roomBoundingBox>
): { left: number; right: number } {
  return (
    horizontalSpanAtY(room.boundary, y, wallInsetFt) ?? {
      left: bbox.x,
      right: bbox.x + bbox.width,
    }
  )
}

function buildVerticalSerpentineCenterline(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  maxBoothDepth: number,
  corridorWidthFt: number,
  wallInsetFt: number,
  reverseFlow: boolean
): Point[] {
  const inset = insetBoundary(room.boundary, wallInsetFt)
  const bbox = roomBoundingBox(inset)
  const laneAdvance = corridorWidthFt + maxBoothDepth + 5
  const usableTop = bbox.y
  const usableBottom = bbox.y + bbox.height

  const start: Point = { x: entrance.x, y: entrance.y }
  const end: Point = { x: exit.x, y: exit.y }
  const centerline: Point[] = [{ ...start }]
  let y = start.y
  const startSpan = spanAtY(room, y, wallInsetFt, bbox)
  let goingRight = start.x < (startSpan.left + startSpan.right) / 2

  if (reverseFlow) {
    while (y < usableBottom - laneAdvance * 0.5) {
      y = Math.min(usableBottom - maxBoothDepth, y + laneAdvance)
      const span = spanAtY(room, y, wallInsetFt, bbox)
      const xEnd = goingRight ? span.right : span.left
      centerline.push({ x: xEnd, y })
      if (y < usableBottom - laneAdvance) {
        const yNext = Math.min(usableBottom, y + laneAdvance * 0.55)
        centerline.push({ x: xEnd, y: yNext })
        y = yNext
      }
      goingRight = !goingRight
    }
  } else {
    while (y > usableTop + laneAdvance * 0.5) {
      y = Math.max(usableTop + maxBoothDepth, y - laneAdvance)
      const span = spanAtY(room, y, wallInsetFt, bbox)
      const xEnd = goingRight ? span.right : span.left
      centerline.push({ x: xEnd, y })
      if (y > usableTop + laneAdvance) {
        const yNext = Math.max(usableTop, y - laneAdvance * 0.55)
        centerline.push({ x: xEnd, y: yNext })
        y = yNext
      }
      goingRight = !goingRight
    }
  }

  centerline.push({ ...end })
  return centerline
}

function buildHorizontalSerpentineCenterline(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  maxBoothDepth: number,
  corridorWidthFt: number,
  wallInsetFt: number,
  reverseFlow: boolean
): Point[] {
  const inset = insetBoundary(room.boundary, wallInsetFt)
  const bbox = roomBoundingBox(inset)
  const laneAdvance = corridorWidthFt + maxBoothDepth + 5
  const usableTop = bbox.y
  const usableBottom = bbox.y + bbox.height
  const usableLeft = bbox.x
  const usableRight = bbox.x + bbox.width

  const start: Point = { x: entrance.x, y: entrance.y }
  const end: Point = { x: exit.x, y: exit.y }
  const centerline: Point[] = [{ ...start }]
  let x = start.x
  let goingDown = start.y < bbox.y + bbox.height / 2

  if (reverseFlow) {
    while (x < usableRight - laneAdvance * 0.5) {
      x = Math.min(usableRight - maxBoothDepth, x + laneAdvance)
      const yEnd = goingDown ? usableBottom : usableTop
      centerline.push({ x, y: yEnd })
      if (x < usableRight - laneAdvance) {
        const xNext = Math.min(usableRight, x + laneAdvance * 0.55)
        centerline.push({ x: xNext, y: yEnd })
        x = xNext
      }
      goingDown = !goingDown
    }
  } else {
    while (x > usableLeft + laneAdvance * 0.5) {
      x = Math.max(usableLeft + maxBoothDepth, x - laneAdvance)
      const yEnd = goingDown ? usableBottom : usableTop
      centerline.push({ x, y: yEnd })
      if (x > usableLeft + laneAdvance) {
        const xNext = Math.max(usableLeft, x - laneAdvance * 0.55)
        centerline.push({ x: xNext, y: yEnd })
        x = xNext
      }
      goingDown = !goingDown
    }
  }

  centerline.push({ ...end })
  return centerline
}

function inferSerpentineFlow(
  entrance: Entrance,
  exit: Exit,
  primaryAxis: SerpentinePrimaryAxis
): boolean {
  if (primaryAxis === 'horizontal') {
    return exit.x > entrance.x
  }
  return exit.y > entrance.y
}

export function buildSerpentineAisle(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  maxBoothDepth: number,
  corridorWidthFt = DEFAULT_CORRIDOR_WIDTH_FT,
  wallInsetFt = DEFAULT_WALL_INSET_FT,
  options?: SerpentineAisleOptions
): AisleSkeleton {
  const circulation = resolveCirculationEndpoints(
    room,
    entrance,
    exit,
    maxBoothDepth,
    wallInsetFt
  )
  const start = circulation.start
  const end = circulation.end
  const verticalSpan = Math.abs(end.y - start.y)
  const horizontalSpan = Math.abs(end.x - start.x)
  const primaryAxis =
    options?.primaryAxis ??
    (horizontalSpan > verticalSpan * 1.15 ? 'horizontal' : 'vertical')
  const reverseFlow =
    options?.reverseFlow ?? inferSerpentineFlow(start, end, primaryAxis)

  let centerline =
    primaryAxis === 'horizontal'
      ? buildHorizontalSerpentineCenterline(
          room,
          start,
          end,
          maxBoothDepth,
          corridorWidthFt,
          wallInsetFt,
          reverseFlow
        )
      : buildVerticalSerpentineCenterline(
          room,
          start,
          end,
          maxBoothDepth,
          corridorWidthFt,
          wallInsetFt,
          reverseFlow
        )

  if (circulation.appendExit) {
    centerline = [...centerline, { ...circulation.appendExit }]
  }

  return clipSerpentineCenterline(
    room,
    { x: entrance.x, y: entrance.y },
    { x: exit.x, y: exit.y },
    centerline,
    corridorWidthFt
  )
}

export function validateRoomBoundary(boundary: Point[]): { ok: boolean; reason?: string } {
  if (boundary.length < 3) {
    return { ok: false, reason: 'Room boundary needs at least 3 points' }
  }
  const area = Math.abs(
    boundary.reduce((sum, p, i) => {
      const n = boundary[(i + 1) % boundary.length]!
      return sum + p.x * n.y - n.x * p.y
    }, 0) / 2
  )
  if (area < 1) {
    return { ok: false, reason: 'Room area too small' }
  }
  return { ok: true }
}

export function validateBoothInRoom(
  booth: { x: number; y: number; width: number; height: number; rotation: number },
  boundary: Point[]
): boolean {
  return allPointsInRoom(boothCorners({ id: '__', ...booth }), boundary)
}

export function maxBoothDepth(booths: Booth[]): number {
  if (booths.length === 0) return 10
  return Math.max(...booths.map((b) => Math.max(b.width, b.height)))
}

export function boothBlocksAisle(
  booth: { x: number; y: number; width: number; height: number; rotation: number },
  aisle: AisleSkeleton
): boolean {
  const aabb = rotatedAabb({ id: '__', ...booth })
  const half = aisle.widthFt / 2
  for (let i = 0; i < aisle.centerline.length - 1; i++) {
    const a = aisle.centerline[i]!
    const b = aisle.centerline[i + 1]!
    const corridor: typeof aabb = {
      x: Math.min(a.x, b.x) - half,
      y: Math.min(a.y, b.y) - half,
      width: Math.abs(b.x - a.x) + aisle.widthFt,
      height: Math.abs(b.y - a.y) + aisle.widthFt,
    }
    if (
      aabb.x < corridor.x + corridor.width &&
      aabb.x + aabb.width > corridor.x &&
      aabb.y < corridor.y + corridor.height &&
      aabb.y + aabb.height > corridor.y
    ) {
      return true
    }
  }
  return false
}
