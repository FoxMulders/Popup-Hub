import { rotatedAabb, type Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { pointInRoom, roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
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

  const aabb = boothFootprintRect(x, y, booth, rotation)
  const corners: Point[] = [
    { x: aabb.x, y: aabb.y },
    { x: aabb.x + aabb.width, y: aabb.y },
    { x: aabb.x + aabb.width, y: aabb.y + aabb.height },
    { x: aabb.x, y: aabb.y + aabb.height },
  ]
  if (!corners.every((c) => pointInRoom(c, boundary))) return false

  const bbox = roomBoundingBox(boundary)
  const padded = expandRect(aabb, aisleFt)
  if (
    padded.x < bbox.x + aisleFt - 1e-6 ||
    padded.y < bbox.y + aisleFt - 1e-6 ||
    padded.x + padded.width > bbox.x + bbox.width - aisleFt + 1e-6 ||
    padded.y + padded.height > bbox.y + bbox.height - aisleFt + 1e-6
  ) {
    return false
  }

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
