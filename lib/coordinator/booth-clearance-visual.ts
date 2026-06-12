import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  rotatedAabb,
  type Rect,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '@/components/coordinator/floor-plan-v2/state/types'

/** Minimum edge-to-edge aisle for published layouts (ft). */
export const BOOTH_CLEARANCE_TARGET_FT = 4

/** Red band — critical violation (ft). */
export const BOOTH_CLEARANCE_CRITICAL_FT = 2

/** Yellow band lower bound — tight clearance begins at this (ft). */
export const BOOTH_CLEARANCE_TIGHT_FT = 3

/** Green band — clean clearance at or above this (ft). */
export const BOOTH_CLEARANCE_GOOD_FT = 4

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
    fillOpacity: 0.78,
  },
  tight: {
    fill: '#fef08a',
    stroke: '#ca8a04',
    fillOpacity: 0.74,
  },
  good: {
    fill: '#bbf7d0',
    stroke: '#16a34a',
    fillOpacity: 0.85,
  },
}

/** Structural fixtures that count as walls for clearance coloring. */
const CLEARANCE_OBSTACLE_KINDS: ReadonlySet<PlacedObject['kind']> = new Set([
  'wall',
  'open_wall',
  'stage',
  'food_truck',
  'door',
  'emergency_exit',
])

/** Minimum positive edge-to-edge gap between two axis-aligned rects (ft). */
export function edgeClearanceBetweenRects(a: Rect, b: Rect): number {
  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX > 0 && overlapY > 0) return 0

  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0)

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

/** ≥4′ good · ≥3′ tight (yellow) · <3′ critical (red, ≤2′ especially tight). */
export function clearanceBand(clearanceFt: number): BoothClearanceBand {
  if (!Number.isFinite(clearanceFt) || clearanceFt >= BOOTH_CLEARANCE_GOOD_FT) {
    return 'good'
  }
  if (clearanceFt >= BOOTH_CLEARANCE_TIGHT_FT) return 'tight'
  return 'critical'
}

/** Clearance theme for a vendor booth probe during draw/hover preview. */
export function vendorBoothClearanceThemeForProbe(
  probe: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom'],
  previewRoomId: string | null | undefined
): BoothClearanceTheme {
  const objectRoomWithProbe =
    previewRoomId != null
      ? { ...(objectRoom ?? {}), [probe.id]: previewRoomId }
      : objectRoom
  const minFt = minVendorBoothClearanceFt(
    probe,
    objects,
    rooms,
    objectRoomWithProbe
  )
  return BOOTH_CLEARANCE_THEMES[clearanceBand(minFt)]
}

/** Drawable booth footprint — edge-to-edge aisle, not collision probe padding. */
function boothPlacementRect(booth: BoothObject): Rect {
  return rotatedAabb(booth)
}

function obstacleClearanceFt(
  boothAabb: Rect,
  other: PlacedObject
): number | null {
  if (!CLEARANCE_OBSTACLE_KINDS.has(other.kind)) return null
  return edgeClearanceBetweenRects(boothAabb, rotatedAabb(other))
}

export function minVendorBoothClearanceFt(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): number {
  const boothAabb = boothPlacementRect(booth)
  let minGap = Number.POSITIVE_INFINITY

  for (const other of objects) {
    if (other.id === booth.id) continue
    if (other.kind === 'booth') {
      if (!isVendorBoothObject(other)) continue
      const gap = edgeClearanceBetweenRects(
        boothAabb,
        boothPlacementRect(other as BoothObject)
      )
      if (gap < minGap) minGap = gap
      continue
    }
    const obstacleGap = obstacleClearanceFt(boothAabb, other)
    if (obstacleGap != null && obstacleGap < minGap) minGap = obstacleGap
  }

  const roomId = objectRoom?.[booth.id]
  const room = roomId ? rooms?.find((r) => r.id === roomId) : undefined
  if (room) {
    const wallGap = clearanceToRoomWallsFt(boothAabb, room)
    if (wallGap < minGap) minGap = wallGap
  }

  if (!Number.isFinite(minGap)) return BOOTH_CLEARANCE_GOOD_FT
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
