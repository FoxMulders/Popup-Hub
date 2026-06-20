import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TARGET_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
} from '@/lib/coordinator/booth-clearance-constants'
import {
  edgeClearanceBetweenRects,
  vendorBoothAisleClearanceFt,
} from '@/lib/floor-plan/rect-edge-clearance'
import {
  rotatedAabb,
  type Rect,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { perimeterFlushRoomEdges } from '@/components/coordinator/floor-plan-v2/interactions/perimeter-booth-orientation'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '@/components/coordinator/floor-plan-v2/state/types'
import {
  boothWithinDoorClearanceZone,
  isDoorOrExitObject,
} from '@/lib/floor-plan/door-clearance-zones'

export {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TARGET_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
} from '@/lib/coordinator/booth-clearance-constants'
export {
  edgeClearanceBetweenRects,
  vendorBoothAisleClearanceFt,
} from '@/lib/floor-plan/rect-edge-clearance'

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
])

function roomInteriorRect(room: RoomFrame): Rect {
  return {
    x: room.originX,
    y: room.originY,
    width: room.widthFt,
    height: room.lengthFt,
  }
}

const ROOM_EDGE_GAP_INDEX: Record<'left' | 'top' | 'right' | 'bottom', number> = {
  left: 0,
  top: 1,
  right: 2,
  bottom: 3,
}

/** Distance from booth AABB to the nearest room perimeter edge (ft). */
export function clearanceToRoomWallsFt(
  boothAabb: Rect,
  room: RoomFrame,
  options?: {
    booth?: BoothObject
  }
): number {
  const interior = roomInteriorRect(room)
  const gaps = [
    boothAabb.x - interior.x,
    boothAabb.y - interior.y,
    interior.x + interior.width - (boothAabb.x + boothAabb.width),
    interior.y + interior.height - (boothAabb.y + boothAabb.height),
  ]

  const booth = options?.booth
  if (booth) {
    for (const edge of perimeterFlushRoomEdges(booth, room)) {
      gaps[ROOM_EDGE_GAP_INDEX[edge]] = Number.POSITIVE_INFINITY
    }
  }

  return Math.min(...gaps)
}

/** ≥4′ good · ≥3′ tight (yellow) · <3′ critical (red, ≤2′ especially tight). */
export function clearanceBand(clearanceFt: number): BoothClearanceBand {
  if (!Number.isFinite(clearanceFt) || clearanceFt >= BOOTH_CLEARANCE_GOOD_FT) {
    return 'good'
  }
  if (clearanceFt >= BOOTH_CLEARANCE_TIGHT_FT) return 'tight'
  return 'critical'
}

/**
 * Shortest edge-to-edge gap to room walls and structural fixtures only.
 * Vendor-to-vendor spacing is intentionally excluded — aisle tightness
 * is not a boundary violation and must not tint booths yellow/red.
 */
export function minVendorBoothBoundaryClearanceFt(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): number {
  const boothAabb = boothPlacementRect(booth)
  let minGap = Number.POSITIVE_INFINITY

  for (const other of objects) {
    if (other.id === booth.id) continue
    const obstacleGap = obstacleClearanceFt(boothAabb, other)
    if (obstacleGap != null && obstacleGap < minGap) minGap = obstacleGap
  }

  const roomId = objectRoom?.[booth.id]
  const room = roomId ? rooms?.find((r) => r.id === roomId) : undefined
  if (room) {
    const wallGap = clearanceToRoomWallsFt(boothAabb, room, { booth })
    if (wallGap < minGap) minGap = wallGap
  }

  if (!Number.isFinite(minGap)) return BOOTH_CLEARANCE_GOOD_FT
  return Math.max(0, minGap)
}

/** Yellow when a real boundary is tight; green when walls/fixtures are clear. */
export function vendorBoothBoundaryWarningBand(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): BoothClearanceBand {
  const minFt = minVendorBoothBoundaryClearanceFt(
    booth,
    objects,
    rooms,
    objectRoom
  )
  return clearanceBand(minFt)
}

/** ≥4′ good · ≥3′ yellow · <3′ red — vendor neighbours, walls, and fixtures. */
export function vendorBoothClearanceWarningBand(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): BoothClearanceBand {
  const minFt = minVendorBoothClearanceFt(
    booth,
    objects,
    rooms,
    objectRoom
  )
  return clearanceBand(minFt)
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
  const band = vendorBoothClearanceWarningBand(
    probe,
    objects,
    rooms,
    objectRoomWithProbe
  )
  return BOOTH_CLEARANCE_THEMES[band]
}

/** Drawable booth footprint — edge-to-edge aisle, not collision probe padding. */
function boothPlacementRect(booth: BoothObject): Rect {
  return rotatedAabb(booth)
}

function obstacleClearanceFt(
  boothAabb: Rect,
  other: PlacedObject
): number | null {
  if (isDoorOrExitObject(other)) {
    if (!boothWithinDoorClearanceZone(boothAabb, other)) return null
    return edgeClearanceBetweenRects(boothAabb, rotatedAabb(other))
  }
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
      const gap = vendorBoothAisleClearanceFt(
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
    const wallGap = clearanceToRoomWallsFt(boothAabb, room, { booth })
    if (wallGap < minGap) minGap = wallGap
  }

  if (!Number.isFinite(minGap)) return BOOTH_CLEARANCE_GOOD_FT
  return Math.max(0, minGap)
}

/**
 * Precompute clearance bands for every vendor booth in one pass.
 * HubGrid passes this map into `CanvasObjects` so the render loop
 * does not call `vendorBoothClearanceWarningBand` per object (INP).
 */
export function vendorBoothClearanceBandsByObjectId(
  objects: ReadonlyArray<PlacedObject>,
  rooms: ReadonlyArray<RoomFrame> | undefined,
  objectRoom: FloorPlanDoc['objectRoom']
): Map<string, BoothClearanceBand> {
  const bands = new Map<string, BoothClearanceBand>()
  for (const obj of objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    if (isGuestTableBooth(booth) || !isVendorBoothObject(booth)) continue
    bands.set(
      obj.id,
      clearanceBand(
        minVendorBoothClearanceFt(booth, objects, rooms, objectRoom)
      )
    )
  }
  return bands
}

export function docHasUnresolvedClearanceIssues(doc: FloorPlanDoc): boolean {
  const rooms = doc.rooms ?? []
  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    if (isGuestTableBooth(booth)) continue
    if (!isVendorBoothObject(booth)) continue
    if (
      vendorBoothClearanceWarningBand(
        booth,
        doc.objects,
        rooms,
        doc.objectRoom
      ) !== 'good'
    ) {
      return true
    }
  }
  return false
}
