import { objectCenter, rotatedAabb } from './geometry'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import {
  expandedFootprintBBox,
  footprintWithinWallClearance,
  MIN_CLEARANCE_FT,
  perimeterStepFt,
} from '@/lib/booth-planner/expanded-footprint'
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

/** Distance (ft) from a room edge for auto-arrange perimeter snap (manual placement uses {@link VENDOR_WALL_SNAP_THRESHOLD_FT}). */
export const PERIMETER_BOOTH_SNAP_FT = 1.25

/** Flush vendor perimeter snap inset (ft) — keep in sync with `VENDOR_WALL_INSET_FT`. */
export const VENDOR_PERIMETER_SNAP_INSET_FT = 0

/**
 * Hysteresis band (ft) when choosing a perimeter wall during drag. Once a booth
 * snaps to one axis, a perpendicular wall must beat it by this margin before the
 * snap target switches — prevents corner flicker (~0.25′ ≈ 3 px at 12 px/ft).
 */
export const WALL_SNAP_EDGE_HYSTERESIS_FT = 0.25

/** Treat two wall distances as tied when within this epsilon (ft). */
const WALL_SNAP_DISTANCE_EPSILON_FT = 0.02

const EDGE_TIE_PRIORITY: Record<RoomEdgeSide, number> = {
  top: 0,
  left: 1,
  right: 2,
  bottom: 3,
}

function isHorizontalEdge(edge: RoomEdgeSide): boolean {
  return edge === 'left' || edge === 'right'
}

function minEdgeDistance(
  candidates: ReadonlyArray<{ edge: RoomEdgeSide; distanceFt: number }>,
  axis: 'horizontal' | 'vertical'
): number {
  const filtered = candidates.filter((c) =>
    axis === 'horizontal' ? isHorizontalEdge(c.edge) : !isHorizontalEdge(c.edge)
  )
  if (filtered.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(...filtered.map((c) => c.distanceFt))
}

/**
 * Pick a single perimeter edge, preferring `preferredEdge` while it remains
 * within tolerance unless another edge is clearly closer (hysteresis band).
 *
 * When horizontal (E/W) and vertical (N/S) distances diverge, only edges on
 * the dominant axis compete — prevents corner jitter from mixed-axis snaps.
 */
export function pickPerimeterEdgeWithHysteresis(
  candidates: ReadonlyArray<{ edge: RoomEdgeSide; distanceFt: number }>,
  preferredEdge?: RoomEdgeSide | null,
  hysteresisFt = WALL_SNAP_EDGE_HYSTERESIS_FT
): { edge: RoomEdgeSide; distanceFt: number } {
  if (candidates.length === 0) {
    return { edge: 'top', distanceFt: Number.POSITIVE_INFINITY }
  }

  const pickFrom = (
    pool: ReadonlyArray<{ edge: RoomEdgeSide; distanceFt: number }>,
    locked?: RoomEdgeSide | null
  ) => {
    const sorted = [...pool].sort((a, b) => {
      const dist = a.distanceFt - b.distanceFt
      if (Math.abs(dist) <= WALL_SNAP_DISTANCE_EPSILON_FT) {
        return EDGE_TIE_PRIORITY[a.edge] - EDGE_TIE_PRIORITY[b.edge]
      }
      return dist
    })
    const closest = sorted[0]!
    if (!locked) return closest
    const preferred = pool.find((c) => c.edge === locked)
    if (!preferred) return closest
    if (closest.edge === locked) return closest
    if (closest.distanceFt + hysteresisFt < preferred.distanceFt) return closest
    return preferred
  }

  if (preferredEdge && isHorizontalEdge(preferredEdge)) {
    const horizontal = candidates.filter((c) => isHorizontalEdge(c.edge))
    if (horizontal.length > 0) {
      return pickFrom(horizontal, preferredEdge)
    }
  }
  if (preferredEdge && !isHorizontalEdge(preferredEdge)) {
    const vertical = candidates.filter((c) => !isHorizontalEdge(c.edge))
    if (vertical.length > 0) {
      return pickFrom(vertical, preferredEdge)
    }
  }

  const minHorizontal = minEdgeDistance(candidates, 'horizontal')
  const minVertical = minEdgeDistance(candidates, 'vertical')
  if (
    Number.isFinite(minHorizontal) &&
    Number.isFinite(minVertical) &&
    Math.abs(minHorizontal - minVertical) > WALL_SNAP_DISTANCE_EPSILON_FT
  ) {
    if (minHorizontal + hysteresisFt < minVertical) {
      return pickFrom(
        candidates.filter((c) => isHorizontalEdge(c.edge)),
        preferredEdge
      )
    }
    if (minVertical + hysteresisFt < minHorizontal) {
      return pickFrom(
        candidates.filter((c) => !isHorizontalEdge(c.edge)),
        preferredEdge
      )
    }
  }

  return pickFrom(candidates, preferredEdge)
}

const INWARD_ROTATION: Record<RoomEdgeSide, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
}

export function rotationForPerimeterEdge(edge: RoomEdgeSide): number {
  return INWARD_ROTATION[edge]
}

/** Long edge (table length) and short edge (equipment depth) for wall orientation. */
export function boothSpanAndDepth(
  width: number,
  height: number,
  tableLengthFt?: number | null
): { span: number; depth: number } {
  if (tableLengthFt != null && tableLengthFt > 0) {
    return {
      span: Math.max(1, Math.round(tableLengthFt)),
      depth: Math.max(BOOTH_EQUIPMENT_DEPTH_FT, Math.min(width, height)),
    }
  }
  return width >= height
    ? { span: width, depth: height }
    : { span: height, depth: width }
}

/**
 * Rotate a booth so its long back edge faces the nearest wall; keeps the
 * footprint center fixed (position snap is handled separately).
 */
export function orientBoothToNearestWallEdge(
  booth: BoothObject,
  frame: RoomFrame
): Pick<BoothObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> {
  const { edge } = nearestRoomEdge(booth, frame)
  const { span, depth } = boothSpanAndDepth(
    booth.width,
    booth.height,
    booth.tableLengthFt
  )
  const center = objectCenter(booth)
  const width = span
  const height = depth
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: rotationForPerimeterEdge(edge),
  }
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
  wallThicknessFt = VENDOR_PERIMETER_SNAP_INSET_FT
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
  frame: RoomFrame,
  wallClearanceFt = MIN_CLEARANCE_FT
): BoothObject {
  const { span, depth } = boothSpanAndDepth(boothW, boothH, booth.tableLengthFt)
  const along =
    slot.edge === 'top' || slot.edge === 'bottom' ? slot.x : slot.y
  return {
    ...booth,
    ...boothAtPerimeterEdge(
      booth,
      slot.edge,
      along,
      frame,
      span,
      depth,
      wallClearanceFt
    ),
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

function roomEdgeDistanceCandidates(
  booth: BoothObject,
  frame: RoomFrame
): Array<{ edge: RoomEdgeSide; distanceFt: number }> {
  const aabb = rotatedAabb(booth)
  const edges = frameEdges(frame)
  return [
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
}

/** Nearest room edge to the booth's rotated AABB (for snap + orient). */
export function nearestRoomEdge(
  booth: BoothObject,
  frame: RoomFrame,
  preferredEdge?: RoomEdgeSide | null
): { edge: RoomEdgeSide; distanceFt: number } {
  return pickPerimeterEdgeWithHysteresis(
    roomEdgeDistanceCandidates(booth, frame),
    preferredEdge
  )
}

export function isBoothSnappedToRoomPerimeter(
  booth: BoothObject,
  frame: RoomFrame,
  tolFt = PERIMETER_BOOTH_SNAP_FT
): boolean {
  return nearestRoomEdge(booth, frame).distanceFt < tolFt
}

/**
 * Snap a booth to the nearest perimeter edge and orient inward.
 * `alongCoord` is the leading-edge position along the wall (local to edge axis).
 */
/** Snap to the nearest edge of a rectilinear union ring (merged / joined zone). */
export function snapBoothToUnionPerimeter(
  booth: BoothObject,
  outerRing: ReadonlyArray<readonly [number, number]>,
  tolFt = PERIMETER_BOOTH_SNAP_FT,
  preferredEdge?: RoomEdgeSide | null
): BoothObject | null {
  const pts = openRingPoints(outerRing)
  if (pts.length < 3) return null
  const centroid = ringCentroid(pts)
  const aabb = rotatedAabb(booth)
  const { span, depth } = boothSpanAndDepth(
    booth.width,
    booth.height,
    booth.tableLengthFt
  )
  const cx = aabb.x + aabb.width / 2
  const cy = aabb.y + aabb.height / 2

  const segmentHits: Array<{
    edge: RoomEdgeSide
    along: number
    lineCoord: number
    distanceFt: number
  }> = []

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
      segmentHits.push({
        edge,
        along: booth.x,
        lineCoord: yLine,
        distanceFt: dist,
      })
    } else {
      const xLine = a.x
      const dist =
        edge === 'left'
          ? Math.abs(aabb.x - xLine)
          : Math.abs(aabb.x + aabb.width - xLine)
      segmentHits.push({
        edge,
        along: booth.y,
        lineCoord: xLine,
        distanceFt: dist,
      })
    }
  }

  if (segmentHits.length === 0) return null

  const edgeDistances = segmentHits.map((hit) => ({
    edge: hit.edge,
    distanceFt: hit.distanceFt,
  }))
  const pickedEdge = pickPerimeterEdgeWithHysteresis(
    edgeDistances,
    preferredEdge
  )
  const best =
    segmentHits
      .filter((hit) => hit.edge === pickedEdge.edge)
      .sort((a, b) => a.distanceFt - b.distanceFt)[0] ?? null

  if (!best || best.distanceFt >= tolFt) return null
  return {
    ...booth,
    ...boothOnUnionEdge(best.edge, best.along, best.lineCoord, span, depth),
  }
}

export function snapBoothToRoomPerimeter(
  booth: BoothObject,
  frame: RoomFrame,
  tolFt = PERIMETER_BOOTH_SNAP_FT,
  preferredEdge?: RoomEdgeSide | null
): BoothObject | null {
  const { edge, distanceFt } = nearestRoomEdge(booth, frame, preferredEdge)
  if (distanceFt >= tolFt) return null

  const { span, depth } = boothSpanAndDepth(
    booth.width,
    booth.height,
    booth.tableLengthFt
  )
  const aabb = rotatedAabb(booth)
  const edges = frameEdges(frame)

  let along = booth.x
  switch (edge) {
    case 'top':
    case 'bottom':
      // Snap Y to the wall; preserve drag X on the along-wall axis.
      along = booth.x
      break
    case 'left':
    case 'right':
      along = booth.y
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
  depthFt: number,
  inset = VENDOR_PERIMETER_SNAP_INSET_FT
): number {
  const ox = frame.originX
  const oy = frame.originY
  const w = frame.widthFt
  const l = frame.lengthFt

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
  inset = VENDOR_PERIMETER_SNAP_INSET_FT
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
 * Uses expanded-footprint hard constraints so corners never overlap.
 */
export function perimeterSlotsAlongRing(
  ring: ReadonlyArray<readonly [number, number]>,
  boothW: number,
  boothH: number,
  _edgeClearanceFt = MIN_CLEARANCE_FT
): PerimeterSlot[] {
  const pts = openRingPoints(ring)
  if (pts.length < 3) return []
  const centroid = ringCentroid(pts)
  const inset = PERIMETER_WALL_THICKNESS_FT + 0.5
  const { span, depth } = boothSpanAndDepth(boothW, boothH)
  const stepAlong = perimeterStepFt(span)
  const slots: PerimeterSlot[] = []
  const placedExpanded: Array<{
    x: number
    y: number
    width: number
    height: number
  }> = []

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const recordIfFits = (pos: PerimeterSlot): void => {
    const probe: BoothObject = {
      id: '__probe__',
      kind: 'booth',
      label: '',
      accentColor: null,
      categoryName: null,
      x: pos.x,
      y: pos.y,
      width: span,
      height: depth,
      rotation: rotationForPerimeterEdge(pos.edge),
    }
    const raw = rotatedAabb(probe)
    const wallClear = Math.max(MIN_CLEARANCE_FT, inset)
    if (
      raw.x < minX + wallClear - 1e-6 ||
      raw.y < minY + wallClear - 1e-6 ||
      raw.x + raw.width > maxX - wallClear + 1e-6 ||
      raw.y + raw.height > maxY - wallClear + 1e-6
    ) {
      return
    }
    const expanded = expandedFootprintBBox(raw)
    if (placedExpanded.some((p) => expandedFootprintsOverlapRaw(expanded, p))) {
      return
    }
    placedExpanded.push(expanded)
    slots.push(pos)
  }

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const edge = edgeForAxisAlignedSegment(a, b, centroid)
    if (!edge) continue

    if (edge === 'top' || edge === 'bottom') {
      const yLine = a.y
      const x0 = Math.min(a.x, b.x)
      const x1 = Math.max(a.x, b.x)
      for (
        let along = x0 + inset;
        along + span <= x1 - inset;
        along += stepAlong
      ) {
        const pos = boothOnUnionEdge(
          edge,
          along,
          yLine,
          span,
          depth,
          MIN_CLEARANCE_FT
        )
        recordIfFits({
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
      for (
        let along = y0 + inset;
        along + span <= y1 - inset;
        along += stepAlong
      ) {
        const pos = boothOnUnionEdge(
          edge,
          along,
          xLine,
          span,
          depth,
          MIN_CLEARANCE_FT
        )
        recordIfFits({
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

function expandedFootprintsOverlapRaw(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Perimeter-only auto-arrange slots tagged with wall edge. */
export function perimeterSlotsWithEdges(
  cw: number,
  cl: number,
  boothW: number,
  boothH: number
): PerimeterSlot[] {
  const wallClear = MIN_CLEARANCE_FT
  const step = perimeterStepFt(boothW)
  const stepY = perimeterStepFt(boothW)
  const slots: PerimeterSlot[] = []
  const placedExpanded: Array<{
    x: number
    y: number
    width: number
    height: number
  }> = []

  const recordIfFits = (slot: PerimeterSlot, rawW: number, rawH: number): void => {
    const raw = { x: slot.x, y: slot.y, width: rawW, height: rawH }
    if (!footprintWithinWallClearance(raw, cw, cl, wallClear)) return
    const expanded = expandedFootprintBBox(raw)
    if (placedExpanded.some((p) => expandedFootprintsOverlapRaw(expanded, p))) {
      return
    }
    placedExpanded.push(expanded)
    slots.push(slot)
  }

  for (let x = wallClear; x + boothW <= cw - wallClear; x += step) {
    recordIfFits({ x, y: wallClear, edge: 'top' }, boothW, boothH)
  }
  for (let y = wallClear + boothH; y + boothW <= cl - wallClear; y += stepY) {
    recordIfFits(
      { x: cw - wallClear - boothH, y, edge: 'right' },
      boothH,
      boothW
    )
  }
  for (let x = cw - wallClear - boothW - step; x >= wallClear; x -= step) {
    recordIfFits(
      { x, y: cl - wallClear - boothH, edge: 'bottom' },
      boothW,
      boothH
    )
  }
  for (let y = cl - wallClear - boothW - stepY; y >= wallClear + boothH; y -= stepY) {
    recordIfFits({ x: wallClear, y, edge: 'left' }, boothH, boothW)
  }

  return slots
}
