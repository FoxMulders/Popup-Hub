import { rotatedAabb, type Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  allPointsInRoom,
  insetBoundary,
  roomBoundingBox,
} from '@/lib/vendor-fairness-layout/geometry/polygon'
import type { Booth, Point, Room } from '../types'

function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Actual rotated booth footprint corners (room-local ft). */
export function boothRotatedCorners(
  x: number,
  y: number,
  booth: Booth,
  rotation: number
): Point[] {
  const center = { x: x + booth.width / 2, y: y + booth.height / 2 }
  const raw: Point[] = [
    { x, y },
    { x: x + booth.width, y },
    { x: x + booth.width, y: y + booth.height },
    { x, y: y + booth.height },
  ]
  if (!rotation) return raw
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return raw.map((c) => {
    const dx = c.x - center.x
    const dy = c.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  })
}

export function boothFootprintRect(
  x: number,
  y: number,
  booth: Booth,
  rotation: number
): Rect {
  return rotatedAabb({
    id: booth.id,
    kind: 'booth',
    x,
    y,
    width: booth.width,
    height: booth.height,
    rotation,
  })
}

export function placementIsValid(
  x: number,
  y: number,
  booth: Booth,
  rotation: number,
  room: Room,
  aisleFt: number,
  obstacles: Rect[],
  placed: Array<{ booth: Booth; x: number; y: number; rotation: number }>
): boolean {
  const boundary = room.boundary
  if (boundary.length < 3) return false

  const corners = boothRotatedCorners(x, y, booth, rotation)
  if (!allPointsInRoom(corners, boundary)) return false

  const wallInset = insetBoundary(boundary, aisleFt)
  if (wallInset.length >= 3 && !allPointsInRoom(corners, wallInset)) {
    return false
  }

  const aabb = boothFootprintRect(x, y, booth, rotation)
  const padded = expandRect(aabb, aisleFt)

  for (const obs of obstacles) {
    if (aabbOverlap(padded, expandRect(obs, aisleFt * 0.5))) return false
  }

  for (const other of placed) {
    if (other.booth.id === booth.id) continue
    const otherRect = boothFootprintRect(
      other.x,
      other.y,
      other.booth,
      other.rotation
    )
    if (aabbOverlap(padded, expandRect(otherRect, aisleFt))) return false
  }

  return true
}

export function validateAllPlacements(
  placed: Array<{ booth: Booth; x: number; y: number; rotation: number }>,
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

/** Keep only valid booths; drop the rest to unplaced. */
export function sanitizePlacements(
  placed: Array<{ booth: Booth; x: number; y: number; rotation: number }>,
  room: Room,
  aisleFt: number,
  obstacles: Rect[]
): {
  valid: Array<{ booth: Booth; x: number; y: number; rotation: number }>
  droppedIds: string[]
} {
  const valid: Array<{ booth: Booth; x: number; y: number; rotation: number }> =
    []
  const droppedIds: string[] = []

  for (const p of placed) {
    if (
      placementIsValid(
        p.x,
        p.y,
        p.booth,
        p.rotation,
        room,
        aisleFt,
        obstacles,
        valid
      )
    ) {
      valid.push(p)
    } else {
      droppedIds.push(p.booth.id)
    }
  }

  return { valid, droppedIds }
}

export function roomExtent(boundary: Point[]): Rect {
  return roomBoundingBox(boundary)
}
