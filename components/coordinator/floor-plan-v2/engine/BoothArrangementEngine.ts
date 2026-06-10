/**

 * Booth bin-packing for merged-zone / room placement surfaces.

 *

 * Delegates to {@link AutoArrangeEngine} traffic-aware path optimization.

 * Keeps doc-level helpers used by pathfinding and UI.

 */



import { type Point } from '../interactions/geometry'

import { orientBoothToNearestWallEdge } from '../interactions/perimeter-booth-orientation'

import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'

import { resolveRoomPlacementBounds } from '@/lib/floor-plan/boundary-constraints'

import { pointInAnyRing } from '../geometry/point-in-polygon'

import {

  resolveRoomPlacementSurface,

  type PlacementRing,

  type PlacementSurface,

} from '../state/placement-surface'

import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'

import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

import {

  AISLE_WIDTH_FT,

  applyPlacementsToBooths,

  packBoothsForRoom,

} from './AutoArrangeEngine'



/** Minimum edge-to-edge aisle between booth footprints (ft). */

export const PACK_BOOTH_AISLE_FT = AISLE_WIDTH_FT



export interface PackBoothsOptions {

  aisleFt?: number

  wallInsetFt?: number

  snapFt?: number

}



export interface PackBoothsResult {

  booths: BoothObject[]

  placedCount: number

  droppedCount: number

}



function boothCorners(obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Point[] {

  const center = {

    x: obj.x + obj.width / 2,

    y: obj.y + obj.height / 2,

  }

  const raw: Point[] = [

    { x: obj.x, y: obj.y },

    { x: obj.x + obj.width, y: obj.y },

    { x: obj.x + obj.width, y: obj.y + obj.height },

    { x: obj.x, y: obj.y + obj.height },

  ]

  if (!obj.rotation) return raw

  const rad = (obj.rotation * Math.PI) / 180

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



function orientBoothToNearestWall(

  booth: BoothObject,

  doc: FloorPlanDoc,

  roomId: string,

  surface: PlacementSurface

): BoothObject {

  const roomFrame = doc.rooms?.find((r) => r.id === roomId)

  const bounds = resolveRoomPlacementBounds(doc, roomId)

  if (!roomFrame || !bounds) return booth



  const snapFrame = {

    ...roomFrame,

    originX: bounds.minX,

    originY: bounds.minY,

    widthFt: bounds.maxX - bounds.minX,

    lengthFt: bounds.maxY - bounds.minY,

  }



  const oriented = orientBoothToNearestWallEdge(booth, snapFrame)

  const next = { ...booth, ...oriented }

  if (boothInsideMergedZone(next, surface.outerRings)) {

    return next

  }



  const rotationOnly = { ...booth, rotation: oriented.rotation }

  if (boothInsideMergedZone(rotationOnly, surface.outerRings)) {

    return rotationOnly

  }



  return booth

}



/**

 * Pack vendor booths inside the active room's placement surface

 * (merged_zone union or rectangular frame) using traffic-aware path

 * optimization with {@link PACK_BOOTH_AISLE_FT} clearance buffers.

 */

export function PackBooths(

  doc: FloorPlanDoc,

  roomId: string,

  booths: BoothObject[],

  options: PackBoothsOptions = {}

): PackBoothsResult {

  const aisleFt = options.aisleFt ?? PACK_BOOTH_AISLE_FT

  const wallInsetFt = options.wallInsetFt ?? PERIMETER_WALL_THICKNESS_FT + 0.5

  const snapFt = options.snapFt ?? doc.snapFt ?? 1



  const surface = resolveRoomPlacementSurface(doc, roomId)

  if (!surface || booths.length === 0) {

    return { booths, placedCount: 0, droppedCount: booths.length }

  }



  const packResult = packBoothsForRoom(

    doc,

    roomId,

    booths.map((b) => ({ id: b.id, width: b.width, height: b.height })),

    { aisleWidth: aisleFt, wallInsetFt, stepFt: snapFt }

  )



  const packed = applyPlacementsToBooths(booths, packResult).map((b) => {

    if (b.x < -900) return b

    return orientBoothToNearestWall(b, doc, roomId, surface)

  })



  const placedCount = packResult.placed.length

  return {

    booths: packed,

    placedCount,

    droppedCount: packResult.unplaced.length,

  }

}



/** Vendor booths tagged to a room — excludes guest/patron tables. */

export function vendorBoothsInRoom(

  doc: FloorPlanDoc,

  roomId: string

): BoothObject[] {

  const objectRoom = doc.objectRoom ?? {}

  return doc.objects.filter(

    (o): o is BoothObject =>

      o.kind === 'booth' &&

      objectRoom[o.id] === roomId &&

      !isGuestTableBooth(o)

  )

}



/**

 * Clear booth coordinates (off-canvas sentinel) then pack inside

 * merged_zone / room surfaces. Returns updated `doc.objects`.

 */

export function applyPackedBoothsToDoc(

  doc: FloorPlanDoc,

  roomId: string,

  packed: BoothObject[]

): FloorPlanDoc {

  const packedById = new Map(packed.map((b) => [b.id, b]))

  const objectRoom = doc.objectRoom ?? {}

  const objects = doc.objects.map((o) => {

    if (o.kind !== 'booth' || objectRoom[o.id] !== roomId) return o

    if (isGuestTableBooth(o)) return o

    const next = packedById.get(o.id)

    if (!next) {

      return { ...o, x: -999, y: -999, rotation: 0 }

    }

    return { ...o, ...next }

  })

  return { ...doc, objects }

}



/** Collect merged_zone outer rings for the active room (when present). */

export function mergedZoneRingsForRoom(

  doc: FloorPlanDoc,

  roomId: string

): PlacementRing[] {

  const surface = resolveRoomPlacementSurface(doc, roomId)

  return surface ? [...surface.outerRings] : []

}



/** True when every corner of the booth lies inside a merged/placement ring. */

export function boothInsideMergedZone(

  booth: BoothObject,

  rings: ReadonlyArray<PlacementRing>

): boolean {

  return boothCorners(booth).every((c) => pointInAnyRing(c, rings))

}



export { packBooths, packBoothsForRoom } from './AutoArrangeEngine'

export type {

  BoothPackInput,

  BoothPlacement,

  PackBoothsResult as TurfPackBoothsResult,

} from './AutoArrangeEngine'


