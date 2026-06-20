/**
 * Patron-path layout density — clearance validation, cross-aisle highways,
 * and minimum room sizing for walkable loops.
 */

import { BOOTH_CLEARANCE_GOOD_FT } from '@/lib/coordinator/booth-clearance-constants'
import {
  BOOTH_PAIR_MIN_EDGE_GAP_FT,
  PATRON_AISLE_MIN_FT,
  PERIMETER_WALL_CLEARANCE_FT,
} from '@/lib/booth-planner/layout-clearance-constants'
import {
  expandedFootprintBBox,
  validateBoothPlacementCoordinate,
} from '@/lib/booth-planner/expanded-footprint'

/** Ideal minimum edge-to-edge pedestrian aisle between booth blocks (ft). */
export const IDEAL_PEDESTRIAN_AISLE_FT = BOOTH_CLEARANCE_GOOD_FT

/** Unobstructed cross-aisle / highway width breaking dense booth blocks (ft). */
export const CROSS_AISLE_HIGHWAY_FT = PATRON_AISLE_MIN_FT

/** Inject a cross-aisle when the grid reaches this many columns. */
export const DENSE_GRID_COLUMN_THRESHOLD = 5

export interface CrossAisleZone {
  x: number
  y: number
  width: number
  height: number
  orientation: 'horizontal' | 'vertical'
}

export interface LayoutDensityInput {
  roomWidthFt: number
  roomLengthFt: number
  boothWidthFt: number
  boothHeightFt: number
  boothCount: number
  wallInsetFt?: number
  /** Edge-to-edge gap between booth columns (ft). */
  tableEdgeGapFt?: number
  /** Aisle between back-to-back row blocks (ft). */
  aisleWidthFt?: number
  entrance?: { x: number; y: number }
}

export interface LayoutDensityAssessment {
  walkingLoopFeasible: boolean
  densityWarning?: string
  suggestedRoomDimensions?: { widthFt: number; lengthFt: number }
  estimatedColumnCount: number
  estimatedBlockRows: number
  maxSlotsWithCrossAisle: number
  requiresCrossAisle: boolean
  crossAisleZones: CrossAisleZone[]
}

export interface GridCapacityEstimate {
  columnCount: number
  blockRowCount: number
  slotCount: number
}

function rectsOverlap(
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

/** Booth raw footprint at top-left. */
function boothRect(
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number; width: number; height: number } {
  return { x, y, width: w, height: h }
}

/**
 * Estimate how many back-to-back grid slots fit, optionally reserving
 * cross-aisle highway bands.
 */
export function estimateGridCapacity(input: {
  roomWidthFt: number
  roomLengthFt: number
  boothWidthFt: number
  boothHeightFt: number
  wallInsetFt: number
  tableEdgeGapFt: number
  aisleWidthFt: number
  crossAisleZones?: ReadonlyArray<CrossAisleZone>
}): GridCapacityEstimate {
  const {
    roomWidthFt: cw,
    roomLengthFt: ch,
    boothWidthFt: tw,
    boothHeightFt: th,
    wallInsetFt: inset,
    tableEdgeGapFt,
    aisleWidthFt,
    crossAisleZones = [],
  } = input

  const wallClear = Math.max(IDEAL_PEDESTRIAN_AISLE_FT, inset)
  const blockHeight = th * 2 + BOOTH_PAIR_MIN_EDGE_GAP_FT
  const blockStep = blockHeight + aisleWidthFt
  const colStep = tw + tableEdgeGapFt
  const minX = Math.max(inset, IDEAL_PEDESTRIAN_AISLE_FT)

  let columnCount = 0
  let colIndex = 0
  while (minX + colIndex * colStep + tw <= cw - wallClear + 1e-6) {
    columnCount++
    colIndex++
  }

  let blockRowCount = 0
  let blockIndex = 0
  while (blockIndex < 5000) {
    const entranceOnTop = true
    const blockY = entranceOnTop
      ? inset + blockIndex * blockStep
      : ch - inset - blockHeight - blockIndex * blockStep
    const y1 = blockY + th + BOOTH_PAIR_MIN_EDGE_GAP_FT + th
    if (y1 > ch - wallClear + 1e-6 || blockY < wallClear - 1e-6) {
      if (blockIndex === 0) break
      break
    }
    blockRowCount++
    blockIndex++
    const nextY = inset + blockIndex * blockStep
    if (nextY + blockHeight > ch - inset + 1e-6) break
  }

  let slotCount = 0
  const placedExpanded: Array<{
    x: number
    y: number
    width: number
    height: number
  }> = []
  blockIndex = 0
  while (blockIndex < blockRowCount) {
    const blockY = inset + blockIndex * blockStep
    const y0 = blockY
    const y1 = blockY + th + BOOTH_PAIR_MIN_EDGE_GAP_FT
    colIndex = 0
    while (minX + colIndex * colStep + tw <= cw - wallClear + 1e-6) {
      const x = minX + colIndex * colStep
      for (const y of [y0, y1]) {
        const raw = boothRect(x, y, tw, th)
        if (crossAisleZones.some((z) => rectsOverlap(raw, z))) continue
        if (
          !validateBoothPlacementCoordinate(raw, cw, ch, placedExpanded)
        ) {
          continue
        }
        placedExpanded.push(expandedFootprintBBox(raw))
        slotCount++
      }
      colIndex++
    }
    blockIndex++
  }

  return { columnCount, blockRowCount, slotCount }
}

/**
 * Plan one cross-aisle highway perpendicular to the primary entry→exit axis.
 */
export function planCrossAisleZones(input: {
  roomWidthFt: number
  roomLengthFt: number
  wallInsetFt: number
  columnCount: number
  entrance?: { x: number; y: number }
}): CrossAisleZone[] {
  const { roomWidthFt: cw, roomLengthFt: ch, wallInsetFt: inset, entrance } =
    input

  const entranceOnTop = entrance == null ? true : entrance.y <= ch / 2
  const entranceOnLeft = entrance != null && entrance.x <= cw / 2 && !entranceOnTop

  if (entranceOnTop || entrance == null) {
    const y = Math.max(inset, ch / 2 - CROSS_AISLE_HIGHWAY_FT / 2)
    return [
      {
        x: inset,
        y,
        width: Math.max(0, cw - inset * 2),
        height: CROSS_AISLE_HIGHWAY_FT,
        orientation: 'horizontal',
      },
    ]
  }

  if (entranceOnLeft) {
    const x = Math.max(inset, cw / 2 - CROSS_AISLE_HIGHWAY_FT / 2)
    return [
      {
        x,
        y: inset,
        width: CROSS_AISLE_HIGHWAY_FT,
        height: Math.max(0, ch - inset * 2),
        orientation: 'vertical',
      },
    ]
  }

  const x = Math.max(inset, cw / 2 - CROSS_AISLE_HIGHWAY_FT / 2)
  return [
    {
      x,
      y: inset,
      width: CROSS_AISLE_HIGHWAY_FT,
      height: Math.max(0, ch - inset * 2),
      orientation: 'vertical',
    },
  ]
}

/** True when the hall needs a patron highway through booth blocks. */
export function shouldInjectCrossAisle(input: {
  columnCount: number
  boothCount: number
  roomWidthFt: number
  roomLengthFt: number
  maxSlotsWithoutCrossAisle: number
}): boolean {
  if (input.columnCount >= DENSE_GRID_COLUMN_THRESHOLD) return true
  if (input.boothCount > input.maxSlotsWithoutCrossAisle) return true
  if (
    input.boothCount >= 30 &&
    input.roomWidthFt <= 60 &&
    input.roomLengthFt <= 60 &&
    input.columnCount >= 4
  ) {
    return true
  }
  return false
}

export function boothOverlapsCrossAisleZone(
  x: number,
  y: number,
  width: number,
  height: number,
  zones: ReadonlyArray<CrossAisleZone>
): boolean {
  const raw = boothRect(x, y, width, height)
  return zones.some((z) => rectsOverlap(raw, z))
}

/**
 * Compute the smallest axis-aligned room that fits `boothCount` booths with
 * ideal aisles and a cross-aisle when the grid is dense.
 */
export function computeMinimumRoomForWalkingLoop(
  input: LayoutDensityInput
): { widthFt: number; lengthFt: number } {
  const wallInsetFt = input.wallInsetFt ?? PERIMETER_WALL_CLEARANCE_FT
  const tableEdgeGapFt = Math.max(
    input.tableEdgeGapFt ?? IDEAL_PEDESTRIAN_AISLE_FT,
    IDEAL_PEDESTRIAN_AISLE_FT
  )
  const aisleWidthFt = Math.max(
    input.aisleWidthFt ?? CROSS_AISLE_HIGHWAY_FT,
    IDEAL_PEDESTRIAN_AISLE_FT
  )

  let widthFt = Math.max(input.roomWidthFt, input.boothWidthFt + wallInsetFt * 2 + 4)
  let lengthFt = Math.max(
    input.roomLengthFt,
    input.boothHeightFt * 4 + wallInsetFt * 2 + CROSS_AISLE_HIGHWAY_FT
  )

  for (let attempt = 0; attempt < 400; attempt++) {
    const assessment = assessLayoutDensityCore({
      ...input,
      roomWidthFt: widthFt,
      roomLengthFt: lengthFt,
      wallInsetFt,
      tableEdgeGapFt,
      aisleWidthFt,
    })
    if (assessment.walkingLoopFeasible) {
      return { widthFt: Math.ceil(widthFt), lengthFt: Math.ceil(lengthFt) }
    }
    if (
      assessment.estimatedColumnCount < DENSE_GRID_COLUMN_THRESHOLD &&
      assessment.maxSlotsWithCrossAisle < input.boothCount
    ) {
      widthFt += 2
    }
    lengthFt += 2
  }

  return {
    widthFt: Math.ceil(widthFt),
    lengthFt: Math.ceil(lengthFt),
  }
}

export function assessLayoutDensity(input: LayoutDensityInput): LayoutDensityAssessment {
  const core = assessLayoutDensityCore(input)
  if (core.walkingLoopFeasible) {
    return core
  }

  const suggestedRoomDimensions = computeMinimumRoomForWalkingLoop(input)
  const densityWarning =
    `Density warning: ${input.boothCount} booths in ${input.roomWidthFt}′×${input.roomLengthFt}′ ` +
    `cannot maintain ${IDEAL_PEDESTRIAN_AISLE_FT}′ aisles and a ${CROSS_AISLE_HIGHWAY_FT}′ cross-aisle ` +
    `for a continuous patron loop (≈${core.maxSlotsWithCrossAisle} safe slots). ` +
    `Recommend at least ${suggestedRoomDimensions.widthFt}′×${suggestedRoomDimensions.lengthFt}′.`

  return {
    ...core,
    densityWarning,
    suggestedRoomDimensions,
  }
}

function assessLayoutDensityCore(input: LayoutDensityInput): LayoutDensityAssessment {
  const wallInsetFt = input.wallInsetFt ?? PERIMETER_WALL_CLEARANCE_FT
  const tableEdgeGapFt = Math.max(
    input.tableEdgeGapFt ?? BOOTH_PAIR_MIN_EDGE_GAP_FT,
    IDEAL_PEDESTRIAN_AISLE_FT
  )
  const aisleWidthFt = Math.max(
    input.aisleWidthFt ?? CROSS_AISLE_HIGHWAY_FT,
    IDEAL_PEDESTRIAN_AISLE_FT
  )

  const baseCapacity = estimateGridCapacity({
    roomWidthFt: input.roomWidthFt,
    roomLengthFt: input.roomLengthFt,
    boothWidthFt: input.boothWidthFt,
    boothHeightFt: input.boothHeightFt,
    wallInsetFt,
    tableEdgeGapFt,
    aisleWidthFt,
  })

  const requiresCrossAisle = shouldInjectCrossAisle({
    columnCount: baseCapacity.columnCount,
    boothCount: input.boothCount,
    roomWidthFt: input.roomWidthFt,
    roomLengthFt: input.roomLengthFt,
    maxSlotsWithoutCrossAisle: baseCapacity.slotCount,
  })

  const crossAisleZones = requiresCrossAisle
    ? planCrossAisleZones({
        roomWidthFt: input.roomWidthFt,
        roomLengthFt: input.roomLengthFt,
        wallInsetFt,
        columnCount: baseCapacity.columnCount,
        entrance: input.entrance,
      })
    : []

  const withCrossAisle = estimateGridCapacity({
    roomWidthFt: input.roomWidthFt,
    roomLengthFt: input.roomLengthFt,
    boothWidthFt: input.boothWidthFt,
    boothHeightFt: input.boothHeightFt,
    wallInsetFt,
    tableEdgeGapFt,
    aisleWidthFt,
    crossAisleZones,
  })

  const aisleGapOk = tableEdgeGapFt >= IDEAL_PEDESTRIAN_AISLE_FT && aisleWidthFt >= IDEAL_PEDESTRIAN_AISLE_FT
  const walkingLoopFeasible =
    aisleGapOk &&
    withCrossAisle.slotCount >= input.boothCount &&
    (!requiresCrossAisle || crossAisleZones.length > 0)

  return {
    walkingLoopFeasible,
    estimatedColumnCount: baseCapacity.columnCount,
    estimatedBlockRows: baseCapacity.blockRowCount,
    maxSlotsWithCrossAisle: withCrossAisle.slotCount,
    requiresCrossAisle,
    crossAisleZones,
  }
}
