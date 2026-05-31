import { rotatedAabb } from './geometry'
import { PERIMETER_WALL_THICKNESS_FT } from './perimeter-walls'
import type { BoothObject, RoomFrame } from '../state/types'

export type RoomEdgeSide = 'top' | 'right' | 'bottom' | 'left'

export interface PerimeterSlot {
  x: number
  y: number
  edge: RoomEdgeSide
  /**
   * When true, `x`/`y` are already placed on a polygon union perimeter
   * (skip rectangular frame re-orientation).
   */
  direct?: boolean
}

/** Distance (ft) from a room edge to treat a booth as perimeter-snapped. */
export const PERIMETER_BOOTH_SNAP_FT = 1.25

const INWARD_ROTATION: Record<RoomEdgeSide, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
}

export function rotationForPerimeterEdge(edge: RoomEdgeSide): number {
  return INWARD_ROTATION[edge]
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
/** Snap to the nearest edge of a rectilinear union ring (merged / joined zone). */
export function snapBoothToUnionPerimeter(
  booth: BoothObject,
  outerRing: ReadonlyArray<readonly [number, number]>,
  tolFt = PERIMETER_BOOTH_SNAP_FT
): BoothObject | null {
  const pts = openRingPoints(outerRing)
  if (pts.length < 3) return null
  const centroid = ringCentroid(pts)
  const aabb = rotatedAabb(booth)
  const { span, depth } = boothSpanAndDepth(booth.width, booth.height)
  const cx = aabb.x + aabb.width / 2
  const cy = aabb.y + aabb.height / 2

  let best: {
    edge: RoomEdgeSide
    along: number
    lineCoord: number
    distanceFt: number
  } | null = null

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const edge = edgeForAxisAlignedSegment(a, b, centroid)
    if (!edge) continue

    if (edge === 'top' || edge === 'bottom') {
      const yLine = a.y
      const dist =
        edge === 'top'
          ? Math.abs(aabb.y - yLine)
          : Math.abs(aabb.y + aabb.height - yLine)
      const along = aabb.x
      if (!best || dist < best.distanceFt) {
        best = { edge, along, lineCoord: yLine, distanceFt: dist }
      }
    } else {
      const xLine = a.x
      const dist =
        edge === 'left'
          ? Math.abs(aabb.x - xLine)
          : Math.abs(aabb.x + aabb.width - xLine)
      const along = aabb.y
      if (!best || dist < best.distanceFt) {
        best = { edge, along, lineCoord: xLine, distanceFt: dist }
      }
    }
  }

  if (!best || best.distanceFt > tolFt) return null
  return {
    ...booth,
    ...boothOnUnionEdge(best.edge, best.along, best.lineCoord, span, depth),
  }
}

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

function openRingPoints(
  ring: ReadonlyArray<readonly [number, number]>
): Array<{ x: number; y: number }> {
  if (ring.length === 0) return []
  const pts = ring.map(([x, y]) => ({ x, y }))
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (first.x === last.x && first.y === last.y) pts.pop()
  return pts
}

function ringCentroid(pts: ReadonlyArray<{ x: number; y: number }>): {
  x: number
  y: number
} {
  if (pts.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / pts.length, y: sy / pts.length }
}

function edgeForAxisAlignedSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  centroid: { x: number; y: number },
  epsilon = 1e-6
): RoomEdgeSide | null {
  if (Math.abs(a.y - b.y) <= epsilon) {
    const y = (a.y + b.y) / 2
    return y <= centroid.y ? 'top' : 'bottom'
  }
  if (Math.abs(a.x - b.x) <= epsilon) {
    const x = (a.x + b.x) / 2
    return x <= centroid.x ? 'left' : 'right'
  }
  return null
}

function boothOnUnionEdge(
  edge: RoomEdgeSide,
  along: number,
  lineCoord: number,
  spanFt: number,
  depthFt: number,
  inset = PERIMETER_WALL_THICKNESS_FT
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> {
  const rotation = INWARD_ROTATION[edge]
  const width = spanFt
  const height = depthFt
  switch (edge) {
    case 'top':
      return { x: along, y: lineCoord + inset, width, height, rotation }
    case 'bottom':
      return { x: along, y: lineCoord - inset - depthFt, width, height, rotation }
    case 'left':
      return { x: lineCoord + inset, y: along, width, height, rotation }
    case 'right':
      return {
        x: lineCoord - inset - depthFt,
        y: along,
        width,
        height,
        rotation,
      }
  }
}

/**
 * Perimeter slots along a rectilinear union ring (post-merge / join zone).
 * Skips collinear stair-steps; each slot is pre-oriented (`direct: true`).
 */
export function perimeterSlotsAlongRing(
  ring: ReadonlyArray<readonly [number, number]>,
  boothW: number,
  boothH: number,
  edgeClearanceFt = 2
): PerimeterSlot[] {
  const pts = openRingPoints(ring)
  if (pts.length < 3) return []
  const centroid = ringCentroid(pts)
  const inset = PERIMETER_WALL_THICKNESS_FT + 0.5
  const stepAlong = boothW + edgeClearanceFt
  const { span, depth } = boothSpanAndDepth(boothW, boothH)
  const slots: PerimeterSlot[] = []

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const edge = edgeForAxisAlignedSegment(a, b, centroid)
    if (!edge) continue

    if (edge === 'top' || edge === 'bottom') {
      const yLine = a.y
      const x0 = Math.min(a.x, b.x)
      const x1 = Math.max(a.x, b.x)
      for (let along = x0 + inset; along + span <= x1 - inset; along += stepAlong) {
        const pos = boothOnUnionEdge(edge, along, yLine, span, depth)
        slots.push({
          x: pos.x,
          y: pos.y,
          edge,
          direct: true,
        })
      }
    } else {
      const xLine = a.x
      const y0 = Math.min(a.y, b.y)
      const y1 = Math.max(a.y, b.y)
      for (let along = y0 + inset; along + span <= y1 - inset; along += stepAlong) {
        const pos = boothOnUnionEdge(edge, along, xLine, span, depth)
        slots.push({
          x: pos.x,
          y: pos.y,
          edge,
          direct: true,
        })
      }
    }
  }

  return slots
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
