import { rotatedAabb } from '../interactions/geometry'
import {
  placementSurfaceFramingBounds,
  resolveRoomPlacementSurface,
} from './placement-surface'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './types'

/**
 * Multi-room canvas sizing and limits.
 *
 * Ceiling rule: each canvas dimension is capped independently at 5× the
 * *primary* room's width and length (`canvasWidthFt ≤ 5 × primary.widthFt`
 * AND `canvasLengthFt ≤ 5 × primary.lengthFt`). The primary room is the
 * first entry in `doc.rooms` (wizard initialization order).
 */

/** Padding (ft) around the room union when sizing the unified canvas. */
export const UNIFIED_CANVAS_MARGIN_FT = 24

/** Per-dimension multiplier vs the primary room. */
export const CANVAS_DIMENSION_SCALE = 5

/** Minimum room width/length (ft) when resizing. */
export const MIN_ROOM_DIMENSION_FT = 10

/** Human-readable room dimensions for the unified room bar. */
export function formatRoomDimensions(widthFt: number, lengthFt: number): string {
  return `${Math.round(widthFt)}' × ${Math.round(lengthFt)}'`
}

export interface FtBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface CanvasDimensionLimits {
  maxWidthFt: number
  maxLengthFt: number
}

export function getPrimaryRoomFrame(
  frames: ReadonlyArray<RoomFrame>
): RoomFrame | null {
  if (frames.length === 0) return null
  let primary = frames[0]!
  let bestArea = primary.widthFt * primary.lengthFt
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]!
    const area = f.widthFt * f.lengthFt
    if (area > bestArea) {
      bestArea = area
      primary = f
    }
  }
  return primary
}

export function canvasDimensionLimits(
  frames: ReadonlyArray<RoomFrame>
): CanvasDimensionLimits | null {
  const primary = getPrimaryRoomFrame(frames)
  if (!primary) return null
  // Symmetric ceiling so a 90° room swap does not shrink the allowed canvas.
  const span =
    Math.max(primary.widthFt, primary.lengthFt) * CANVAS_DIMENSION_SCALE
  return {
    maxWidthFt: span,
    maxLengthFt: span,
  }
}

/**
 * Limits for clamping room drag/resize: at least the nominal 5× primary
 * cap, the current canvas size, and the post-gesture room union (+ margin).
 * Without this, `reconcileCanvasExtents` can grow the canvas past 5× while
 * moves still hit the stricter cap and feel "stuck".
 */
export function limitsForRoomUnion(
  frames: ReadonlyArray<RoomFrame>,
  trialFrames: ReadonlyArray<RoomFrame>,
  canvasWidthFt = 0,
  canvasLengthFt = 0
): CanvasDimensionLimits {
  const nominal = canvasDimensionLimits(frames)
  const bounds = roomUnionBounds(trialFrames)
  const margin = UNIFIED_CANVAS_MARGIN_FT
  const neededW = Math.max(50, bounds.maxX + margin)
  const neededL = Math.max(50, bounds.maxY + margin)
  return {
    maxWidthFt: Math.max(
      nominal?.maxWidthFt ?? neededW,
      canvasWidthFt,
      neededW
    ),
    maxLengthFt: Math.max(
      nominal?.maxLengthFt ?? neededL,
      canvasLengthFt,
      neededL
    ),
  }
}

/** Union bounding box of all room frames in canvas-global feet. */
export function roomUnionBounds(frames: ReadonlyArray<RoomFrame>): FtBounds {
  if (frames.length === 0) {
    return { minX: 0, minY: 0, maxX: 50, maxY: 50 }
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = 0
  let maxY = 0
  for (const f of frames) {
    const ox = Math.max(0, f.originX)
    const oy = Math.max(0, f.originY)
    if (ox < minX) minX = ox
    if (oy < minY) minY = oy
    const right = ox + f.widthFt
    const bottom = oy + f.lengthFt
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  if (!Number.isFinite(minX)) minX = 0
  if (!Number.isFinite(minY)) minY = 0
  return { minX, minY, maxX, maxY }
}

/** Union of room frames and every placed object's rotated footprint. */
export function unionCanvasContentBounds(
  frames: ReadonlyArray<RoomFrame>,
  objects?: ReadonlyArray<PlacedObject>
): FtBounds {
  const room = roomUnionBounds(frames)
  if (!objects?.length) return room

  let { minX, minY, maxX, maxY } = room
  for (const obj of objects) {
    const aabb = rotatedAabb(obj)
    const right = aabb.x + aabb.width
    const bottom = aabb.y + aabb.height
    if (aabb.x < minX) minX = aabb.x
    if (aabb.y < minY) minY = aabb.y
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  if (!Number.isFinite(minX)) minX = 0
  if (!Number.isFinite(minY)) minY = 0
  return { minX, minY, maxX, maxY }
}

/** Bounds used to frame the viewport on the active room (not the full canvas). */
export function activeRoomFramingBounds(
  frames: ReadonlyArray<RoomFrame>,
  activeRoomId: string | null | undefined,
  objects?: ReadonlyArray<PlacedObject>,
  objectRoom?: Readonly<Record<string, string>>
): FtBounds {
  const frame =
    (activeRoomId ? frames.find((f) => f.id === activeRoomId) : null) ??
    frames[0]
  if (!frame) return roomUnionBounds(frames)

  if (activeRoomId && objects) {
    const doc: FloorPlanDoc = {
      canvasWidthFt: 0,
      canvasLengthFt: 0,
      gridSpacingFt: 1,
      snapFt: 1,
      objects: [...objects],
      rooms: [...frames],
      objectRoom: objectRoom ? { ...objectRoom } : undefined,
    }
    const surface = resolveRoomPlacementSurface(doc, activeRoomId)
    if (surface) {
      return placementSurfaceFramingBounds(surface)
    }
  }

  let minX = frame.originX
  let minY = frame.originY
  let maxX = minX + frame.widthFt
  let maxY = minY + frame.lengthFt

  if (objects?.length) {
    for (const obj of objects) {
      const roomId = objectRoom?.[obj.id]
      if (roomId && roomId !== frame.id) continue
      const aabb = rotatedAabb(obj)
      const right = aabb.x + aabb.width
      const bottom = aabb.y + aabb.height
      if (aabb.x < minX) minX = aabb.x
      if (aabb.y < minY) minY = aabb.y
      if (right > maxX) maxX = right
      if (bottom > maxY) maxY = bottom
    }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Desired canvas extents from rooms + placed objects plus margin.
 * Grows past the nominal 5× ceiling when rotated content requires it.
 */
export function reconcileCanvasExtents(
  frames: ReadonlyArray<RoomFrame>,
  marginFt = UNIFIED_CANVAS_MARGIN_FT,
  objects?: ReadonlyArray<PlacedObject>
): { canvasWidthFt: number; canvasLengthFt: number } {
  const bounds = unionCanvasContentBounds(frames, objects)
  const neededW = Math.max(50, bounds.maxX + marginFt)
  const neededL = Math.max(50, bounds.maxY + marginFt)
  const limits = canvasDimensionLimits(frames)
  if (!limits) {
    return { canvasWidthFt: neededW, canvasLengthFt: neededL }
  }
  return {
    canvasWidthFt:
      neededW > limits.maxWidthFt
        ? neededW
        : Math.min(neededW, limits.maxWidthFt),
    canvasLengthFt:
      neededL > limits.maxLengthFt
        ? neededL
        : Math.min(neededL, limits.maxLengthFt),
  }
}

function framesWithMovedRoom(
  frames: ReadonlyArray<RoomFrame>,
  roomId: string,
  dx: number,
  dy: number
): RoomFrame[] {
  return frames.map((f) =>
    f.id === roomId
      ? { ...f, originX: f.originX + dx, originY: f.originY + dy }
      : f
  )
}

function framesWithResizedRoom(
  frames: ReadonlyArray<RoomFrame>,
  roomId: string,
  next: Pick<RoomFrame, 'originX' | 'originY' | 'widthFt' | 'lengthFt'>
): RoomFrame[] {
  return frames.map((f) => (f.id === roomId ? { ...f, ...next } : f))
}

/**
 * Clamp a room translation so the post-move union stays inside the
 * 5× canvas limits and room origins stay non-negative.
 */
export function clampRoomMoveDelta(
  frames: ReadonlyArray<RoomFrame>,
  roomId: string,
  dx: number,
  dy: number,
  options?: { canvasWidthFt?: number; canvasLengthFt?: number }
): { dx: number; dy: number } {
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 }
  const frame = frames.find((f) => f.id === roomId)
  if (!frame) return { dx: 0, dy: 0 }

  const canvasW = options?.canvasWidthFt ?? 0
  const canvasL = options?.canvasLengthFt ?? 0

  let outDx = dx
  let outDy = dy
  if (frame.originX + outDx < 0) outDx = -frame.originX
  if (frame.originY + outDy < 0) outDy = -frame.originY

  const trial = framesWithMovedRoom(frames, roomId, outDx, outDy)
  const limits = limitsForRoomUnion(frames, trial, canvasW, canvasL)
  const bounds = roomUnionBounds(trial)
  if (bounds.maxX <= limits.maxWidthFt && bounds.maxY <= limits.maxLengthFt) {
    return { dx: outDx, dy: outDy }
  }

  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const tdx = outDx * mid
    const tdy = outDy * mid
    const moved = framesWithMovedRoom(frames, roomId, tdx, tdy)
    const f = moved.find((r) => r.id === roomId)!
    if (f.originX < 0 || f.originY < 0) {
      hi = mid
      continue
    }
    const moveLimits = limitsForRoomUnion(frames, moved, canvasW, canvasL)
    const b = roomUnionBounds(moved)
    if (
      b.maxX <= moveLimits.maxWidthFt &&
      b.maxY <= moveLimits.maxLengthFt
    ) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return { dx: outDx * lo, dy: outDy * lo }
}

export type RoomResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

export interface RoomResizePatch {
  originX: number
  originY: number
  widthFt: number
  lengthFt: number
}

/**
 * Apply a resize handle drag from an initial frame snapshot.
 * Objects stay at global coords; only the frame rectangle changes.
 */
export function roomResizeFromHandle(
  initial: RoomFrame,
  handle: RoomResizeHandle,
  pointerFt: { x: number; y: number },
  anchorFt: { x: number; y: number }
): RoomResizePatch {
  const x0 = initial.originX
  const y0 = initial.originY
  const w0 = initial.widthFt
  const l0 = initial.lengthFt
  const right0 = x0 + w0
  const bottom0 = y0 + l0
  const px = pointerFt.x
  const py = pointerFt.y

  let originX = x0
  let originY = y0
  let widthFt = w0
  let lengthFt = l0

  switch (handle) {
    case 'se':
      widthFt = px - x0
      lengthFt = py - y0
      break
    case 'e':
      widthFt = px - x0
      break
    case 's':
      lengthFt = py - y0
      break
    case 'nw':
      originX = px
      originY = py
      widthFt = right0 - px
      lengthFt = bottom0 - py
      break
    case 'n':
      originY = py
      lengthFt = bottom0 - py
      break
    case 'ne':
      originY = py
      widthFt = px - x0
      lengthFt = bottom0 - py
      break
    case 'sw':
      originX = px
      widthFt = right0 - px
      lengthFt = py - y0
      break
    case 'w':
      originX = px
      widthFt = right0 - px
      break
    default:
      break
  }

  void anchorFt

  widthFt = Math.max(MIN_ROOM_DIMENSION_FT, widthFt)
  lengthFt = Math.max(MIN_ROOM_DIMENSION_FT, lengthFt)
  if (originX < 0) originX = 0
  if (originY < 0) originY = 0

  return { originX, originY, widthFt, lengthFt }
}

/**
 * Clamp a proposed resize so the room union respects canvas limits.
 * Returns null when the patch would exceed the 5× ceiling.
 */
export function clampRoomResizePatch(
  frames: ReadonlyArray<RoomFrame>,
  roomId: string,
  patch: RoomResizePatch,
  options?: { canvasWidthFt?: number; canvasLengthFt?: number }
): RoomResizePatch | null {
  const next = { ...patch }
  next.widthFt = Math.max(MIN_ROOM_DIMENSION_FT, next.widthFt)
  next.lengthFt = Math.max(MIN_ROOM_DIMENSION_FT, next.lengthFt)
  if (next.originX < 0) next.originX = 0
  if (next.originY < 0) next.originY = 0

  const trial = framesWithResizedRoom(frames, roomId, next)
  const limits = limitsForRoomUnion(
    frames,
    trial,
    options?.canvasWidthFt ?? 0,
    options?.canvasLengthFt ?? 0
  )
  const bounds = roomUnionBounds(trial)
  if (bounds.maxX <= limits.maxWidthFt && bounds.maxY <= limits.maxLengthFt) {
    return next
  }
  return null
}

/**
 * Stepped zoom: start at `zoomMax` and multiply by `stepFactor` until the
 * room union fits the viewport (or hit `zoomMin`).
 */
export function steppedFitZoom(
  bounds: FtBounds,
  viewportPxW: number,
  viewportPxH: number,
  basePxPerFt: number,
  options?: {
    padding?: number
    stepFactor?: number
    zoomMin?: number
    zoomMax?: number
  }
): number {
  const padding = options?.padding ?? 0.12
  const stepFactor = options?.stepFactor ?? 0.8
  const zoomMin = options?.zoomMin ?? 0.25
  const zoomMax = options?.zoomMax ?? 3
  const widthFt = Math.max(1e-6, bounds.maxX - bounds.minX)
  const heightFt = Math.max(1e-6, bounds.maxY - bounds.minY)
  const usableW = Math.max(40, viewportPxW * (1 - padding * 2))
  const usableH = Math.max(40, viewportPxH * (1 - padding * 2))

  let zoom = zoomMax
  while (zoom >= zoomMin) {
    const pxPerFt = basePxPerFt * zoom
    if (widthFt * pxPerFt <= usableW && heightFt * pxPerFt <= usableH) {
      return zoom
    }
    zoom *= stepFactor
  }
  return zoomMin
}
