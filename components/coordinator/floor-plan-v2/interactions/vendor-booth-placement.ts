/**
 * Vendor booth manual placement — wall snap + lateral clearance collision.
 */

import { BOOTH_SAFETY_BUFFER_FT } from '@/lib/booth-planner/layout-clearance-constants'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  isBoothSnappedToRoomPerimeter,
  nearestRoomEdge,
  orientBoothToNearestWallEdge,
  PERIMETER_BOOTH_SNAP_FT,
  snapBoothToRoomPerimeter,
  snapBoothToUnionPerimeter,
  type RoomEdgeSide,
} from './perimeter-booth-orientation'
import { resolveRoomPlacementBounds } from '@/lib/floor-plan/boundary-constraints'
import { resolveRoomPlacementSurface } from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'

export type { RoomEdgeSide } from './perimeter-booth-orientation'

/** Snap vendor booths when within this distance (ft) of a room perimeter wall. */
export const VENDOR_WALL_SNAP_THRESHOLD_FT = 3

/** Tighter threshold for cursor ghost preview before click (2′). */
export const PLACEMENT_PREVIEW_WALL_SNAP_FT = 2

/** Mandatory 2′ clearance on every booth edge for collision tests (ft). */
export const VENDOR_BOOTH_CLEARANCE_FT = BOOTH_SAFETY_BUFFER_FT

/** @deprecated Use {@link VENDOR_BOOTH_CLEARANCE_FT}. */
export const VENDOR_LATERAL_CLEARANCE_FT = VENDOR_BOOTH_CLEARANCE_FT

/** Context for asymmetric wall-snapped vendor collision probes. */
export type VendorCollisionContext = Pick<
  FloorPlanDoc,
  | 'canvasWidthFt'
  | 'canvasLengthFt'
  | 'gridSpacingFt'
  | 'snapFt'
  | 'objects'
  | 'rooms'
  | 'objectRoom'
>

type LocalPadding = {
  top: number
  right: number
  bottom: number
  left: number
}

const CARDINAL_ROTATIONS_DEG = [0, 90, 180, 270] as const

/** True when rotation is a wall-aligned cardinal angle (within 0.5°). */
export function isCardinalRotation(rotationDeg: number): boolean {
  const n = ((rotationDeg % 360) + 360) % 360
  return CARDINAL_ROTATIONS_DEG.some(
    (cardinal) => Math.abs(n - cardinal) < 0.5 || Math.abs(n - cardinal - 360) < 0.5
  )
}

export function isVendorBoothObject(
  obj: PlacedObject
): obj is BoothObject {
  return obj.kind === 'booth' && !isGuestTableBooth(obj as BoothObject)
}

/**
 * Expand a vendor booth footprint uniformly by {@link VENDOR_BOOTH_CLEARANCE_FT}
 * on every local edge. A 6′×4′ table tests as 10′×8′ for overlap detection.
 */
export function vendorBoothUniformCollisionProbe(
  booth: BoothObject,
  clearanceFt = VENDOR_BOOTH_CLEARANCE_FT
): BoothObject {
  const pad = clearanceFt
  return expandBoothLocalPadding(booth, {
    top: pad,
    right: pad,
    bottom: pad,
    left: pad,
  })
}

/** @deprecated Use {@link vendorBoothUniformCollisionProbe}. */
export function vendorBoothLateralCollisionProbe(
  booth: BoothObject,
  lateralPaddingFt = VENDOR_BOOTH_CLEARANCE_FT
): BoothObject {
  return vendorBoothUniformCollisionProbe(booth, lateralPaddingFt)
}

function uniformPadding(clearanceFt: number): LocalPadding {
  return {
    top: clearanceFt,
    right: clearanceFt,
    bottom: clearanceFt,
    left: clearanceFt,
  }
}

/** Back edge flush to wall — omit rear buffer; keep 2′ on interior sides. */
function wallSnapPaddingForRotation(
  rotationDeg: number,
  clearanceFt: number
): LocalPadding {
  const r = ((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360
  const p = clearanceFt
  switch (r) {
    case 0:
      return { top: 0, right: p, bottom: p, left: p }
    case 90:
      return { top: p, right: 0, bottom: p, left: p }
    case 180:
      return { top: p, right: p, bottom: 0, left: p }
    case 270:
      return { top: p, right: p, bottom: p, left: 0 }
    default:
      return uniformPadding(p)
  }
}

function expandBoothLocalPadding(
  booth: BoothObject,
  pad: LocalPadding
): BoothObject {
  return {
    ...booth,
    x: booth.x - pad.left,
    y: booth.y - pad.top,
    width: booth.width + pad.left + pad.right,
    height: booth.height + pad.top + pad.bottom,
  }
}

function collisionDocSlice(
  ctx?: VendorCollisionContext
): VendorCollisionContext | null {
  if (!ctx?.rooms?.length) return null
  return {
    canvasWidthFt: ctx.canvasWidthFt ?? 0,
    canvasLengthFt: ctx.canvasLengthFt ?? 0,
    gridSpacingFt: ctx.gridSpacingFt ?? 1,
    snapFt: ctx.snapFt ?? 1,
    objects: ctx.objects ?? [],
    rooms: ctx.rooms ?? [],
    objectRoom: ctx.objectRoom,
  }
}

/** True when booth rear is flush to a room perimeter (allows zero back buffer). */
export function isVendorBoothWallSnappedForCollision(
  booth: BoothObject,
  ctx?: VendorCollisionContext
): boolean {
  if (!isCardinalRotation(booth.rotation ?? 0)) return false
  const doc = collisionDocSlice(ctx)
  if (!doc) return false
  const frame = roomFrameForBooth(booth, doc.rooms ?? [], doc.objectRoom ?? {})
  if (!frame) return false
  const roomId = doc.objectRoom?.[booth.id] ?? frame.id
  const snapFrame = snapFrameForRoom(doc, roomId, frame)
  return isBoothSnappedToRoomPerimeter(
    booth,
    snapFrame,
    PERIMETER_BOOTH_SNAP_FT + 0.25
  )
}

/**
 * Vendor collision probe — 2′ on all sides, or asymmetric when wall-snapped
 * (rear buffer omitted against the perimeter wall).
 */
export function vendorBoothCollisionProbe(
  booth: BoothObject,
  ctx?: VendorCollisionContext
): BoothObject {
  const clearanceFt = VENDOR_BOOTH_CLEARANCE_FT
  const pad = isVendorBoothWallSnappedForCollision(booth, ctx)
    ? wallSnapPaddingForRotation(booth.rotation ?? 0, clearanceFt)
    : uniformPadding(clearanceFt)
  return expandBoothLocalPadding(booth, pad)
}

/** Collision probe — 360° vendor buffer with wall exception; unchanged otherwise. */
export function collisionProbeForObject(
  obj: PlacedObject,
  ctx?: VendorCollisionContext
): PlacedObject {
  if (isVendorBoothObject(obj)) {
    return vendorBoothCollisionProbe(obj, ctx)
  }
  return obj
}

function roomFrameForBooth(
  booth: BoothObject,
  rooms: ReadonlyArray<RoomFrame>,
  objectRoom: Record<string, string>
): RoomFrame | null {
  const ownerId = objectRoom[booth.id]
  if (ownerId) {
    return rooms.find((r) => r.id === ownerId) ?? null
  }
  const cx = booth.x + booth.width / 2
  const cy = booth.y + booth.height / 2
  for (const frame of rooms) {
    if (
      cx >= frame.originX &&
      cx <= frame.originX + frame.widthFt &&
      cy >= frame.originY &&
      cy <= frame.originY + frame.lengthFt
    ) {
      return frame
    }
  }
  return null
}

/** Room frame aligned to the active placement surface (union / merged bounds). */
function snapFrameForRoom(
  doc: Pick<FloorPlanDoc, 'rooms' | 'objects' | 'canvasWidthFt' | 'canvasLengthFt' | 'gridSpacingFt' | 'snapFt' | 'objectRoom'>,
  roomId: string,
  frame: RoomFrame
): RoomFrame {
  const bounds = resolveRoomPlacementBounds(
    {
      canvasWidthFt: doc.canvasWidthFt ?? 0,
      canvasLengthFt: doc.canvasLengthFt ?? 0,
      gridSpacingFt: doc.gridSpacingFt ?? 1,
      snapFt: doc.snapFt ?? 1,
      objects: doc.objects ?? [],
      rooms: doc.rooms ?? [],
      objectRoom: doc.objectRoom,
    },
    roomId
  )
  if (!bounds) return frame
  return {
    ...frame,
    originX: bounds.minX,
    originY: bounds.minY,
    widthFt: bounds.maxX - bounds.minX,
    lengthFt: bounds.maxY - bounds.minY,
  }
}

/** Orient long back edge toward nearest wall without changing snap position. */
export function orientVendorBoothToNearestWall(
  booth: BoothObject,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom' | 'objects' | 'canvasWidthFt' | 'canvasLengthFt' | 'gridSpacingFt' | 'snapFt'>
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> | null {
  const frame = roomFrameForBooth(
    booth,
    doc.rooms ?? [],
    doc.objectRoom ?? {}
  )
  if (!frame) return null

  const roomId = doc.objectRoom?.[booth.id] ?? frame.id
  const snapFrame = snapFrameForRoom(doc, roomId, frame)
  return orientBoothToNearestWallEdge(booth, snapFrame)
}

/**
 * Snap a vendor booth to the nearest wall when within
 * {@link VENDOR_WALL_SNAP_THRESHOLD_FT}, orienting inward (0/90/180/270°).
 */
export function snapVendorBoothToPerimeter(
  booth: BoothObject,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom' | 'objects' | 'canvasWidthFt' | 'canvasLengthFt' | 'gridSpacingFt' | 'snapFt'>,
  snapToleranceFt: number = VENDOR_WALL_SNAP_THRESHOLD_FT,
  preferredEdge?: RoomEdgeSide | null
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> | null {
  const frame = roomFrameForBooth(
    booth,
    doc.rooms ?? [],
    doc.objectRoom ?? {}
  )
  if (!frame) return null

  const roomId = doc.objectRoom?.[booth.id] ?? frame.id
  const snapFrame = snapFrameForRoom(doc, roomId, frame)
  const surface = resolveRoomPlacementSurface(
    {
      canvasWidthFt: doc.canvasWidthFt ?? 0,
      canvasLengthFt: doc.canvasLengthFt ?? 0,
      gridSpacingFt: doc.gridSpacingFt ?? 1,
      snapFt: doc.snapFt ?? 1,
      objects: doc.objects ?? [],
      rooms: doc.rooms ?? [],
      objectRoom: doc.objectRoom,
    },
    roomId
  )
  const tol = snapToleranceFt
  const unionRing = surface?.outerRings[0]
  const snapped = unionRing
    ? snapBoothToUnionPerimeter(booth, unionRing, tol, preferredEdge) ??
      snapBoothToRoomPerimeter(booth, snapFrame, tol, preferredEdge)
    : snapBoothToRoomPerimeter(booth, snapFrame, tol, preferredEdge)
  if (!snapped) return null
  return {
    x: snapped.x,
    y: snapped.y,
    width: snapped.width,
    height: snapped.height,
    rotation: snapped.rotation,
  }
}

/** Perimeter edge used by the latest vendor snap (for drag hysteresis). */
export function vendorBoothPerimeterSnapEdge(
  booth: BoothObject,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom' | 'objects' | 'canvasWidthFt' | 'canvasLengthFt' | 'gridSpacingFt' | 'snapFt'>,
  snapToleranceFt: number = VENDOR_WALL_SNAP_THRESHOLD_FT
): RoomEdgeSide | null {
  const frame = roomFrameForBooth(
    booth,
    doc.rooms ?? [],
    doc.objectRoom ?? {}
  )
  if (!frame) return null
  const roomId = doc.objectRoom?.[booth.id] ?? frame.id
  const snapFrame = snapFrameForRoom(doc, roomId, frame)
  const { edge, distanceFt } = nearestRoomEdge(booth, snapFrame)
  return distanceFt <= snapToleranceFt ? edge : null
}

/** Apply perimeter snap or wall-facing orientation for vendor booths. */
export function vendorBoothPerimeterSnapPatch(
  booth: BoothObject,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom' | 'objects' | 'canvasWidthFt' | 'canvasLengthFt' | 'gridSpacingFt' | 'snapFt'>,
  options?: { preferredEdge?: RoomEdgeSide | null }
): Partial<BoothObject> | null {
  return (
    snapVendorBoothToPerimeter(
      booth,
      doc,
      VENDOR_WALL_SNAP_THRESHOLD_FT,
      options?.preferredEdge
    ) ?? orientVendorBoothToNearestWall(booth, doc)
  )
}
