/**
 * Booth layout engine — grid snap increments, drag/nudge placement loop,
 * and shared move-patch pipeline for pointer drag + keyboard nudge.
 */

import { footprintClampDeltaForRoom } from '@/lib/floor-plan/boundary-constraints'
import { DEFAULT_SNAP_FT } from '../state/types'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import { canvasClampDelta, objectCenter, snapToGrid } from '../interactions/geometry'
import {
  boothSpanAndDepth,
  rotationForPerimeterEdge,
  type RoomEdgeSide,
} from '../interactions/perimeter-booth-orientation'
import {
  isCardinalRotation,
  isVendorBoothObject,
  vendorBoothPerimeterSnapEdge,
  vendorBoothPerimeterSnapPatch,
} from '../interactions/vendor-booth-placement'

/** Default booth drag / arrow-nudge increment (feet). */
export const BOOTH_MOVE_SNAP_FT = 1

/** Shift-modifier booth drag / arrow-nudge increment (feet). */
export const BOOTH_MOVE_SNAP_SHIFT_FT = 5

/** Max center-Y delta (ft) to treat vendor booths as sharing a horizontal row. */
export const BOOTH_ROW_CENTER_TOLERANCE_FT = 1

export function resolveBoothMoveSnapFt(options: {
  shiftKey?: boolean
  shiftHeld?: boolean
  docSnapFt?: number
}): number {
  if (options.shiftKey || options.shiftHeld) return BOOTH_MOVE_SNAP_SHIFT_FT
  const docSnap = options.docSnapFt ?? DEFAULT_SNAP_FT
  return docSnap > 0 ? docSnap : BOOTH_MOVE_SNAP_FT
}

function boothCenterFt(b: Pick<BoothObject, 'x' | 'y' | 'width' | 'height'>) {
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }
}

/** Map a cardinal booth rotation to the perimeter wall its back edge faces. */
export function wallEdgeFromRotation(rotationDeg: number): RoomEdgeSide {
  const r = ((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360
  switch (r) {
    case 0:
      return 'top'
    case 90:
      return 'right'
    case 180:
      return 'bottom'
    case 270:
      return 'left'
    default:
      return 'top'
  }
}

/**
 * Nearest vendor booth on the same horizontal row (by center Y).
 * Used to inherit wall-facing orientation during manual placement.
 */
export function findVendorBoothRowPeer(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  options?: { excludeId?: string; gridSpacingFt?: number }
): BoothObject | null {
  const { cx, cy } = boothCenterFt(booth)
  const grid = options?.gridSpacingFt ?? 1
  const tolerance = Math.max(BOOTH_ROW_CENTER_TOLERANCE_FT, grid * 0.5)
  let best: BoothObject | null = null
  let bestDx = Number.POSITIVE_INFINITY

  for (const other of objects) {
    if (other.id === booth.id || other.id === options?.excludeId) continue
    if (!isVendorBoothObject(other)) continue
    const peer = other as BoothObject
    const { cx: pcx, cy: pcy } = boothCenterFt(peer)
    if (Math.abs(pcy - cy) > tolerance) continue
    const dx = Math.abs(pcx - cx)
    if (dx < bestDx) {
      bestDx = dx
      best = peer
    }
  }
  return best
}

/** Align rotation and long-edge layout with a row peer (same wall facing). */
export function vendorBoothOrientationFromRowPeer(
  booth: BoothObject,
  peer: BoothObject
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> {
  const edge = wallEdgeFromRotation(peer.rotation ?? 0)
  const { span, depth } = boothSpanAndDepth(
    booth.width,
    booth.height,
    booth.tableLengthFt
  )
  const center = objectCenter(booth)
  return {
    x: center.x - span / 2,
    y: center.y - depth / 2,
    width: span,
    height: depth,
    rotation: rotationForPerimeterEdge(edge),
  }
}

function objectWithPatch(
  obj: PlacedObject,
  patch: Partial<PlacedObject>
): PlacedObject {
  return { ...obj, ...patch } as PlacedObject
}

function applyVendorWallSnap(
  booth: BoothObject,
  doc: Pick<
    FloorPlanDoc,
    | 'rooms'
    | 'objectRoom'
    | 'objects'
    | 'canvasWidthFt'
    | 'canvasLengthFt'
    | 'gridSpacingFt'
    | 'snapFt'
  >,
  options?: {
    preferredEdge?: RoomEdgeSide | null
    positionOnly?: boolean
    snapRotation?: boolean
  }
): BoothObject {
  const rowPeer = findVendorBoothRowPeer(booth, doc.objects ?? [], {
    excludeId: booth.id,
    gridSpacingFt: doc.gridSpacingFt,
  })
  let working = booth
  let preferredEdge = options?.preferredEdge ?? null
  if (rowPeer) {
    working = { ...booth, ...vendorBoothOrientationFromRowPeer(booth, rowPeer) }
    preferredEdge = wallEdgeFromRotation(rowPeer.rotation ?? 0)
  }

  const snap = vendorBoothPerimeterSnapPatch(working, doc, {
    preferredEdge,
    positionOnly: options?.positionOnly,
  })
  if (!snap) return working
  const snapRotation = options?.snapRotation ?? true
  if (!snapRotation || !isCardinalRotation(booth.rotation ?? 0)) {
    const { rotation: _ignored, ...positionPatch } = snap
    return { ...working, ...positionPatch } as BoothObject
  }
  return { ...working, ...snap } as BoothObject
}

export interface BoothLayoutMoveOptions {
  snapFt: number
  activeRoomId?: string | null
  preferredEdge?: RoomEdgeSide | null
  /** When true, perimeter snap adjusts position only (live drag). */
  positionOnly?: boolean
  /** When false, skip wall rotation on non-cardinal booths. */
  snapRotation?: boolean
}

/**
 * Single-object placement loop: snap grid → optional wall snap → room clamp.
 * Used by pointer drag frames and keyboard nudge.
 */
export function boothLayoutMovePatch(
  obj: PlacedObject,
  origin: { x: number; y: number },
  totalDx: number,
  totalDy: number,
  doc: FloorPlanDoc,
  options: BoothLayoutMoveOptions
): Partial<PlacedObject> {
  const snapFt = options.snapFt > 0 ? options.snapFt : BOOTH_MOVE_SNAP_FT
  let patch: Partial<PlacedObject> = {
    x: snapToGrid(origin.x + totalDx, snapFt),
    y: snapToGrid(origin.y + totalDy, snapFt),
  }

  if (isVendorBoothObject(obj)) {
    const snapped = applyVendorWallSnap(
      objectWithPatch(obj, patch) as BoothObject,
      doc,
      {
        preferredEdge: options.preferredEdge,
        positionOnly: options.positionOnly ?? true,
        snapRotation: options.snapRotation,
      }
    )
    patch = {
      x: snapped.x,
      y: snapped.y,
      width: snapped.width,
      height: snapped.height,
      rotation: snapped.rotation,
    }
  }

  const roomId = doc.objectRoom?.[obj.id] ?? options.activeRoomId ?? null
  const probe = objectWithPatch(obj, patch)
  const roomClamp = footprintClampDeltaForRoom(probe, doc, roomId)
  patch = {
    ...patch,
    x: (patch.x ?? obj.x) + roomClamp.dx,
    y: (patch.y ?? obj.y) + roomClamp.dy,
  }

  const clampedProbe = objectWithPatch(obj, patch)
  const canvasClamp = canvasClampDelta(
    clampedProbe,
    doc.canvasWidthFt,
    doc.canvasLengthFt
  )
  return {
    ...patch,
    x: (patch.x ?? obj.x) + canvasClamp.dx,
    y: (patch.y ?? obj.y) + canvasClamp.dy,
  }
}

/** Resolve locked perimeter edge after a live drag frame (wall hysteresis). */
export function boothLayoutLockedWallEdge(
  booth: BoothObject,
  doc: FloorPlanDoc
): RoomEdgeSide | null {
  return vendorBoothPerimeterSnapEdge(booth, doc)
}

/** Commit-time vendor snap + final grid quantize (pointer-up). */
export function boothLayoutCommitPatch(
  obj: PlacedObject,
  doc: FloorPlanDoc,
  options: {
    snapFt: number
    activeRoomId?: string | null
    preferredEdge?: RoomEdgeSide | null
  }
): Partial<PlacedObject> {
  let patch: Partial<PlacedObject> = { x: obj.x, y: obj.y }
  if (isVendorBoothObject(obj)) {
    const snapped = applyVendorWallSnap(obj as BoothObject, doc, {
      preferredEdge: options.preferredEdge,
      positionOnly: false,
    })
    const snapFt = options.snapFt > 0 ? options.snapFt : BOOTH_MOVE_SNAP_FT
    patch = {
      x: snapToGrid(snapped.x, snapFt),
      y: snapToGrid(snapped.y, snapFt),
      width: snapped.width,
      height: snapped.height,
      rotation: snapped.rotation,
    }
  }

  const roomId = doc.objectRoom?.[obj.id] ?? options.activeRoomId ?? null
  if (obj.kind === 'booth' && roomId) {
    const clamp = footprintClampDeltaForRoom(
      objectWithPatch(obj, patch),
      doc,
      roomId
    )
    if (clamp.dx !== 0 || clamp.dy !== 0) {
      patch = {
        ...patch,
        x: (patch.x ?? obj.x) + clamp.dx,
        y: (patch.y ?? obj.y) + clamp.dy,
      }
    }
  }
  return patch
}
