import { DEFAULT_CORRIDOR_WIDTH_FT, DEFAULT_WALL_INSET_FT } from '../constants'
import type { AisleSkeleton, Booth, Entrance, Exit, Point, Room } from '../types'
import { boothCorners, rotatedAabb } from './booth-rect'
import { allPointsInRoom, insetBoundary, pointInRoom, roomBoundingBox } from './polygon'

export function buildSerpentineAisle(
  room: Room,
  entrance: Entrance,
  exit: Exit,
  maxBoothDepth: number,
  corridorWidthFt = DEFAULT_CORRIDOR_WIDTH_FT,
  wallInsetFt = DEFAULT_WALL_INSET_FT
): AisleSkeleton {
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
  let y = start.y
  let goingRight = start.x < bbox.x + bbox.width / 2

  while (y > usableTop + laneAdvance * 0.5) {
    y = Math.max(usableTop + maxBoothDepth, y - laneAdvance)
    const xEnd = goingRight ? usableRight : usableLeft
    centerline.push({ x: xEnd, y })
    if (y > usableTop + laneAdvance) {
      const yNext = Math.max(usableTop, y - laneAdvance * 0.55)
      centerline.push({ x: xEnd, y: yNext })
      y = yNext
    }
    goingRight = !goingRight
  }

  centerline.push({ ...end })

  const clipped = centerline.filter((p) => pointInRoom(p, room.boundary))
  if (clipped.length < 2) {
    return { centerline: [start, end], widthFt: corridorWidthFt }
  }
  return { centerline: clipped, widthFt: corridorWidthFt }
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
