import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  rotatedAabb,
  type Rect,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { objectFootprintAabb } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '@/components/coordinator/floor-plan-v2/state/types'

/** Preferred minimum edge clearance between vendor booths and walls (ft). */
export const BOOTH_CLEARANCE_TARGET_FT = 3

/** Edge clearance at or below this reads as critically tight (ft). */
export const BOOTH_CLEARANCE_CRITICAL_FT = 1

/** Edge clearance at or below this reads as tight (ft). */
export const BOOTH_CLEARANCE_TIGHT_FT = 2

export type BoothClearanceBand = 'critical' | 'tight' | 'good'

export interface BoothClearanceTheme {
  fill: string
  stroke: string
  fillOpacity: number
}

export const BOOTH_CLEARANCE_THEMES: Record<BoothClearanceBand, BoothClearanceTheme> = {
  critical: {
    fill: '#fecaca',
    stroke: '#dc2626',
    fillOpacity: 0.72,
  },
  tight: {
    fill: '#fed7aa',
    stroke: '#ea580c',
    fillOpacity: 0.68,
  },
  good: {
    fill: '#bbf7d0',
    stroke: '#16a34a',
    fillOpacity: 0.55,
  },
}

/** Minimum positive edge-to-edge gap between two axis-aligned rects (ft). */
export function edgeClearanceBetweenRects(a: Rect, b: Rect): number {
  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX > 0 && overlapY > 0) return 0

  const gapX =
    overlapY > 0
      ? Math.max(
          a.x - (b.x + b.width),
          b.x - (a.x + a.width),
          0
        )
      : 0
  const gapY =
    overlapX > 0
      ? Math.max(
          a.y - (b.y + b.height),
          b.y - (a.y + a.height),
          0
        )
      : 0

  if (gapX > 0 && gapY > 0) return Math.min(gapX, gapY)
  if (gapX > 0) return gapX
  if (gapY > 0) return gapY
  return 0
}

function roomInteriorRect(room: RoomFrame): Rect {
  return {
    x: room.originX,
    y: room.originY,
    width: room.widthFt,
    height: room.lengthFt,
  }
}

/** Distance from booth AABB to the nearest room perimeter edge (ft). */
export function clearanceToRoomWallsFt(
  boothAabb: Rect,
  room: RoomFrame
): number {
  const interior = roomInteriorRect(room)
  const left = boothAabb.x - interior.x
  const top = boothAabb.y - interior.y
  const right = interior.x + interior.width - (boothAabb.x + boothAabb.width)
  const bottom = interior.y + interior.height - (boothAabb.y + boothAabb.height)
  return Math.min(left, top, right, bottom)
}

export function clearanceBand(clearanceFt: number): BoothClearanceBand {
  if (clearanceFt <= BOOTH_CLEARANCE_CRITICAL_FT) return 'critical'
  if (clearanceFt < BOOTH_CLEARANCE_TARGET_FT) return 'tight'
  return 'good'
}

export function minVendorBoothClearanceFt(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): number {
  const boothAabb = objectFootprintAabb(booth)
  let minGap = Number.POSITIVE_INFINITY

  for (const other of objects) {
    if (other.id === booth.id || other.kind !== 'booth') continue
    if (!isVendorBoothObject(other)) continue
    const gap = edgeClearanceBetweenRects(boothAabb, rotatedAabb(other))
    if (gap < minGap) minGap = gap
  }

  const roomId = objectRoom?.[booth.id]
  const room = roomId ? rooms?.find((r) => r.id === roomId) : undefined
  if (room) {
    const wallGap = clearanceToRoomWallsFt(boothAabb, room)
    if (wallGap < minGap) minGap = wallGap
  }

  if (!Number.isFinite(minGap)) return BOOTH_CLEARANCE_TARGET_FT
  return Math.max(0, minGap)
}

export function docHasUnresolvedClearanceIssues(doc: FloorPlanDoc): boolean {
  const rooms = doc.rooms ?? []
  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    if (isGuestTableBooth(booth)) continue
    if (!isVendorBoothObject(booth)) continue
    const minFt = minVendorBoothClearanceFt(
      booth,
      doc.objects,
      rooms,
      doc.objectRoom
    )
    if (clearanceBand(minFt) !== 'good') return true
  }
  return false
}
