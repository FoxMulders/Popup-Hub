import { rotatedAabb } from './geometry'
import { PERIMETER_WALL_THICKNESS_FT } from './perimeter-walls'
import type { BoothObject, RoomFrame } from '../state/types'

export type RoomEdgeSide = 'top' | 'right' | 'bottom' | 'left'

export interface PerimeterSlot {
  x: number
  y: number
  edge: RoomEdgeSide
}

/** Distance (ft) from a room edge to treat a booth as perimeter-snapped. */
export const PERIMETER_BOOTH_SNAP_FT = 1.25

const INWARD_ROTATION: Record<RoomEdgeSide, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
}

function boothSpanAndDepth(width: number, height: number): { span: number; depth: number } {
  return width >= height
    ? { span: width, depth: height }
    : { span: height, depth: width }
}

/**
 * Place a rectangular booth with its long back edge flush to the room
 * perimeter inner face; vendor opening faces inward (toward room center).
 */
export function boothAtPerimeterEdge(
  booth: BoothObject,
  edge: RoomEdgeSide,
  alongCoord: number,
  frame: RoomFrame,
  spanFt: number,
  depthFt: number,
  wallThicknessFt = PERIMETER_WALL_THICKNESS_FT
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> {
  const rotation = INWARD_ROTATION[edge]
  const width = spanFt
  const height = depthFt
  const ox = frame.originX
  const oy = frame.originY
  const w = frame.widthFt
  const l = frame.lengthFt
  const inset = wallThicknessFt

  let x = alongCoord
  let y = alongCoord

  switch (edge) {
    case 'top':
      x = alongCoord
      y = oy + inset
      break
    case 'bottom':
      x = alongCoord
      y = oy + l - inset - depthFt
      break
    case 'left':
      x = ox + inset
      y = alongCoord
      break
    case 'right':
      x = ox + w - inset - depthFt
      y = alongCoord
      break
  }

  return { ...booth, x, y, width, height, rotation }
}

/** Auto-arrange slot with edge tag → oriented booth in room-local coords. */
export function orientBoothForPerimeterSlot(
  booth: BoothObject,
  slot: PerimeterSlot,
  boothW: number,
  boothH: number,
  frame: RoomFrame
): BoothObject {
  const { span, depth } = boothSpanAndDepth(boothW, boothH)
  const along =
    slot.edge === 'top' || slot.edge === 'bottom' ? slot.x : slot.y
  return {
    ...booth,
    ...boothAtPerimeterEdge(booth, slot.edge, along, frame, span, depth),
  }
}

function frameEdges(frame: RoomFrame) {
  const ox = frame.originX
  const oy = frame.originY
  const w = frame.widthFt
  const l = frame.lengthFt
  return {
    top: oy,
    bottom: oy + l,
    left: ox,
    right: ox + w,
  }
}

/** Nearest room edge to the booth's rotated AABB (for snap + orient). */
export function nearestRoomEdge(
  booth: BoothObject,
  frame: RoomFrame
): { edge: RoomEdgeSide; distanceFt: number } {
  const aabb = rotatedAabb(booth)
  const edges = frameEdges(frame)
  const candidates: Array<{ edge: RoomEdgeSide; distanceFt: number }> = [
    { edge: 'top', distanceFt: Math.abs(aabb.y - edges.top) },
    {
      edge: 'bottom',
      distanceFt: Math.abs(aabb.y + aabb.height - edges.bottom),
    },
    { edge: 'left', distanceFt: Math.abs(aabb.x - edges.left) },
    {
      edge: 'right',
      distanceFt: Math.abs(aabb.x + aabb.width - edges.right),
    },
  ]
  candidates.sort((a, b) => a.distanceFt - b.distanceFt)
  return candidates[0]!
}

export function isBoothSnappedToRoomPerimeter(
  booth: BoothObject,
  frame: RoomFrame,
  tolFt = PERIMETER_BOOTH_SNAP_FT
): boolean {
  return nearestRoomEdge(booth, frame).distanceFt <= tolFt
}

/**
 * Snap a booth to the nearest perimeter edge and orient inward.
 * `alongCoord` is the leading-edge position along the wall (local to edge axis).
 */
export function snapBoothToRoomPerimeter(
  booth: BoothObject,
  frame: RoomFrame,
  tolFt = PERIMETER_BOOTH_SNAP_FT
): BoothObject | null {
  const { edge, distanceFt } = nearestRoomEdge(booth, frame)
  if (distanceFt > tolFt) return null

  const { span, depth } = boothSpanAndDepth(booth.width, booth.height)
  const aabb = rotatedAabb(booth)
  const edges = frameEdges(frame)

  let along = booth.x
  switch (edge) {
    case 'top':
    case 'bottom':
      along = aabb.x
      break
    case 'left':
    case 'right':
      along = aabb.y
      break
  }

  const oriented = boothAtPerimeterEdge(
    booth,
    edge,
    along,
    frame,
    span,
    depth
  )

  const clampedAlong = clampAlongEdge(edge, oriented, frame, span, depth)
  return {
    ...booth,
    ...boothAtPerimeterEdge(booth, edge, clampedAlong, frame, span, depth),
  }
}

function clampAlongEdge(
  edge: RoomEdgeSide,
  booth: Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  frame: RoomFrame,
  spanFt: number,
  depthFt: number
): number {
  const ox = frame.originX
  const oy = frame.originY
  const w = frame.widthFt
  const l = frame.lengthFt
  const inset = PERIMETER_WALL_THICKNESS_FT

  if (edge === 'top' || edge === 'bottom') {
    const min = ox + inset
    const max = ox + w - inset - spanFt
    return Math.min(max, Math.max(min, booth.x))
  }
  const min = oy + inset
  const max = oy + l - inset - spanFt
  return Math.min(max, Math.max(min, booth.y))
}

/** Perimeter-only auto-arrange slots tagged with wall edge. */
export function perimeterSlotsWithEdges(
  cw: number,
  cl: number,
  boothW: number,
  boothH: number
): PerimeterSlot[] {
  const inset = PERIMETER_WALL_THICKNESS_FT + 0.5
  const step = boothW + 2
  const stepY = boothH + 2
  const slots: PerimeterSlot[] = []

  for (let x = inset; x + boothW <= cw - inset; x += step) {
    slots.push({ x, y: inset, edge: 'top' })
  }
  for (let y = inset + boothH + 2; y + boothH <= cl - inset; y += stepY) {
    slots.push({ x: cw - inset - boothW, y, edge: 'right' })
  }
  for (let x = cw - inset - boothW - step; x >= inset; x -= step) {
    slots.push({ x, y: cl - inset - boothH, edge: 'bottom' })
  }
  for (
    let y = cl - inset - boothH - stepY;
    y >= inset + boothH + 2;
    y -= stepY
  ) {
    slots.push({ x: inset, y, edge: 'left' })
  }

  return slots
}
