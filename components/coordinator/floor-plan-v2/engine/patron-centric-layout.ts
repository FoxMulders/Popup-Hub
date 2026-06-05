/**
 * Patron-centric auto-arrange — sightlines, winding aisles, angled booths.
 *
 * Core entry: `calculatePatronCentricLayout(roomWidth, roomHeight, objectsToPlace)`.
 *
 * Design goals (patron walking the venue):
 * - Winding main corridor (~7 ft) instead of rigid parallel back-to-back rows.
 * - Booths angled along path tangents (chevron / herringbone / conversational).
 * - Facades fall inside a 60° forward vision cone from the nearest path point.
 * - Staggered sides so vendors are not stacked directly in line-of-sight.
 * - Rotated OBB collision via `rotatedAabb` for placement validation.
 */

import {
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
} from '../interactions/category-rules'
import { rotatedAabb, type Point, type Rect } from '../interactions/geometry'
import type { BoothObject, PlacedObject } from '../state/types'

/** Keep in sync with `auto-arrange.ts` spacing spec. */
const BOOTH_EDGE_CLEARANCE_FT = 0
const FRONT_CLEARANCE_FT = 5
const WALL_BUFFER_FT = 3.5

/** Main patron aisle width (ft) — within 6–8 ft clearance spec. */
export const PATRON_CORRIDOR_WIDTH_FT = 7

/** Full forward vision cone (degrees). */
export const PATRON_VISION_CONE_DEG = 60

const HALF_VISION_COS = Math.cos((PATRON_VISION_CONE_DEG / 2) * (Math.PI / 180))

export type PatronLayoutStyle =
  | 'adaptive'
  | 'chevron-45'
  | 'herringbone-30'
  | 'conversational-60'

export interface PatronLayoutPoint {
  x: number
  y: number
}

/** Booth (or booth-shaped object) to place — pass through ids and metadata. */
export type PatronLayoutObjectInput = Pick<
  BoothObject,
  'id' | 'width' | 'height' | 'categoryName' | 'accentColor' | 'vendorId' | 'tableLengthFt' | 'tableCount' | 'label'
> &
  Partial<BoothObject>

export interface PatronCentricLayoutOptions {
  entrance?: PatronLayoutPoint
  exit?: PatronLayoutPoint
  /** Structural obstacles (walls, stages, …) as rotated AABBs. */
  obstacles?: Rect[]
  corridorWidthFt?: number
  visionConeDeg?: number
  gridSpacingFt?: number
  eventCategoryNames?: ReadonlyArray<string>
  layoutStyle?: PatronLayoutStyle
  edgeClearanceFt?: number
  wallInsetFt?: number
}

export interface PatronCentricPlacedObject extends PatronLayoutObjectInput {
  x: number
  y: number
  rotation: number
  kind: 'booth'
}

export interface PatronCentricLayoutResult {
  placed: PatronCentricPlacedObject[]
  dropped: PatronLayoutObjectInput[]
  /** Higher is better (0–1 normalized aggregate). */
  visualEquityScore: number
  /** Main patron corridor polyline (ft). */
  pathway: PatronLayoutPoint[]
  unsatisfiedCategoryCount: number
  /** Style chosen when `adaptive`. */
  resolvedStyle: PatronLayoutStyle
}

interface LayoutSlot {
  x: number
  y: number
  rotation: number
  pathDist: number
  side: 'left' | 'right'
  tangentDeg: number
}

type PlacementProbe = BoothObject

function degToRad(d: number): number {
  return (d * Math.PI) / 180
}

function normalizeDeg(d: number): number {
  let x = d % 360
  if (x < 0) x += 360
  return x
}

function tangentDegFromSegment(a: PatronLayoutPoint, b: PatronLayoutPoint): number {
  return normalizeDeg((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI)
}

function unitFromDeg(deg: number): { x: number; y: number } {
  const r = degToRad(deg)
  return { x: Math.cos(r), y: Math.sin(r) }
}

function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function probeFromPlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  id: string
): PlacementProbe {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width,
    height,
    rotation,
    accentColor: null,
  }
}

function boothTopLeftFromCenter(
  cx: number,
  cy: number,
  width: number,
  height: number
): { x: number; y: number } {
  return { x: cx - width / 2, y: cy - height / 2 }
}

function facadeNormalTowardPath(
  tangentDeg: number,
  side: 'left' | 'right'
): { x: number; y: number } {
  const t = unitFromDeg(tangentDeg)
  const leftNormal = { x: -t.y, y: t.x }
  if (side === 'left') {
    return { x: -leftNormal.x, y: -leftNormal.y }
  }
  return leftNormal
}

function styleLateralFactor(style: PatronLayoutStyle): number {
  switch (style) {
    case 'herringbone-30':
      return Math.tan(degToRad(30))
    case 'chevron-45':
      return Math.tan(degToRad(45))
    case 'conversational-60':
      return Math.tan(degToRad(60))
    case 'adaptive':
      return Math.tan(degToRad(45))
    default:
      return Math.tan(degToRad(45))
  }
}

/**
 * Serpentine main corridor from entrance toward exit — not axis-aligned rows.
 */
export function buildPatronPathway(
  roomWidth: number,
  roomHeight: number,
  entrance: PatronLayoutPoint,
  exit: PatronLayoutPoint,
  corridorWidthFt: number,
  maxBoothDepth: number
): PatronLayoutPoint[] {
  const inset = WALL_BUFFER_FT
  const laneAdvance =
    corridorWidthFt + maxBoothDepth + FRONT_CLEARANCE_FT
  const usableTop = inset
  const usableBottom = roomHeight - inset
  const usableLeft = inset
  const usableRight = roomWidth - inset

  const points: PatronLayoutPoint[] = [{ ...entrance }]
  let y = entrance.y
  let goingRight = entrance.x < roomWidth / 2

  while (y > usableTop + laneAdvance * 0.5) {
    y = Math.max(usableTop + maxBoothDepth, y - laneAdvance)
    const xEnd = goingRight ? usableRight : usableLeft
    points.push({ x: xEnd, y })
    if (y > usableTop + laneAdvance) {
      const xHold = xEnd
      const yNext = Math.max(usableTop, y - laneAdvance * 0.55)
      points.push({ x: xHold, y: yNext })
      y = yNext
    }
    goingRight = !goingRight
  }

  points.push({ ...exit })
  return points
}

function pathCumulativeDistances(path: PatronLayoutPoint[]): number[] {
  const dist = [0]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    dist.push(dist[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  return dist
}

function pointAlongPath(
  path: PatronLayoutPoint[],
  cumDist: number[],
  target: number
): { point: PatronLayoutPoint; tangentDeg: number; pathDist: number } {
  for (let i = 1; i < path.length; i++) {
    const d0 = cumDist[i - 1]!
    const d1 = cumDist[i]!
    if (target > d1) continue
    const a = path[i - 1]!
    const b = path[i]!
    const segLen = d1 - d0 || 1
    const t = (target - d0) / segLen
    return {
      point: {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      },
      tangentDeg: tangentDegFromSegment(a, b),
      pathDist: target,
    }
  }
  const last = path[path.length - 1]!
  const prev = path[path.length - 2] ?? last
  return {
    point: last,
    tangentDeg: tangentDegFromSegment(prev, last),
    pathDist: cumDist[cumDist.length - 1] ?? 0,
  }
}

/**
 * Candidate slots along both sides of the winding corridor.
 */
export function generatePatronLayoutSlots(
  roomWidth: number,
  roomHeight: number,
  path: PatronLayoutPoint[],
  boothWidth: number,
  boothHeight: number,
  options: {
    corridorWidthFt: number
    style: PatronLayoutStyle
  }
): LayoutSlot[] {
  const cum = pathCumulativeDistances(path)
  const total = cum[cum.length - 1] ?? 0
  const stepAlong = boothWidth + BOOTH_EDGE_CLEARANCE_FT + 0.5
  const zigzag = styleLateralFactor(options.style) * boothWidth * 0.25
  const rowOffsets = [
    options.corridorWidthFt / 2 + boothHeight + FRONT_CLEARANCE_FT * 0.65,
  ]

  const slots: LayoutSlot[] = []
  let sideFlip = 0

  for (let dist = stepAlong * 0.4; dist < total; dist += stepAlong) {
    const { point, tangentDeg, pathDist } = pointAlongPath(path, cum, dist)
    const t = unitFromDeg(tangentDeg)
    const leftNormal = { x: -t.y, y: t.x }
    const sides: Array<'left' | 'right'> =
      sideFlip % 2 === 0 ? ['left', 'right'] : ['right', 'left']
    sideFlip++

    for (const side of sides) {
      const sign = side === 'left' ? 1 : -1
      for (let row = 0; row < rowOffsets.length; row++) {
        const stagger =
          (side === 'left' ? 1 : -1) *
          zigzag *
          ((Math.floor(dist / stepAlong) + row) % 2)
        const offsetDist = rowOffsets[row]! + stagger
        const cx = point.x + leftNormal.x * sign * offsetDist
        const cy = point.y + leftNormal.y * sign * offsetDist
        const { x, y } = boothTopLeftFromCenter(cx, cy, boothWidth, boothHeight)
        const probe = probeFromPlacement(
          x,
          y,
          boothWidth,
          boothHeight,
          tangentDeg,
          '__slot__'
        )
        if (!slotFitsRoom(probe, roomWidth, roomHeight)) continue
        slots.push({
          x,
          y,
          rotation: tangentDeg,
          pathDist: pathDist + row * 0.01,
          side,
          tangentDeg,
        })
      }
    }
  }

  slots.sort((a, b) => a.pathDist - b.pathDist)
  return slots
}

function slotFitsRoom(
  probe: PlacementProbe,
  roomWidth: number,
  roomHeight: number
): boolean {
  const aabb = rotatedAabb(probe)
  return (
    aabb.x >= WALL_BUFFER_FT &&
    aabb.y >= WALL_BUFFER_FT &&
    aabb.x + aabb.width <= roomWidth - WALL_BUFFER_FT &&
    aabb.y + aabb.height <= roomHeight - WALL_BUFFER_FT
  )
}

function segmentIntersectsRect(
  a: PatronLayoutPoint,
  b: PatronLayoutPoint,
  rect: Rect
): boolean {
  if (rectContains(rect, a) || rectContains(rect, b)) return true
  const samples = 8
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    }
    if (rectContains(rect, p)) return true
  }
  return false
}

function rectContains(rect: Rect, p: PatronLayoutPoint): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  )
}

function isOccludedFromPath(
  pathPoint: PatronLayoutPoint,
  facadePoint: PatronLayoutPoint,
  placed: PatronCentricPlacedObject[],
  skipId?: string
): boolean {
  for (const p of placed) {
    if (skipId && p.id === skipId) continue
    const aabb = rotatedAabb(p as PlacementProbe)
    if (segmentIntersectsRect(pathPoint, facadePoint, aabb)) return true
  }
  return false
}

function visionScoreForSlot(
  slot: LayoutSlot,
  boothW: number,
  boothH: number,
  pathPoint: PatronLayoutPoint,
  placed: PatronCentricPlacedObject[],
  halfConeCos: number
): number {
  const walk = unitFromDeg(slot.tangentDeg)
  const cx = slot.x + boothW / 2
  const cy = slot.y + boothH / 2
  const toBoothX = cx - pathPoint.x
  const toBoothY = cy - pathPoint.y
  const toLen = Math.hypot(toBoothX, toBoothY) || 1
  const toDirX = toBoothX / toLen
  const toDirY = toBoothY / toLen
  const cross = Math.abs(walk.x * toDirY - walk.y * toDirX)
  const coneScore = cross >= halfConeCos ? 1 : cross / halfConeCos

  const facadeN = facadeNormalTowardPath(slot.tangentDeg, slot.side)
  const facadePt = {
    x: cx + facadeN.x * (boothH * 0.5),
    y: cy + facadeN.y * (boothH * 0.5),
  }

  let occlusion = 0
  if (isOccludedFromPath(pathPoint, facadePt, placed)) {
    occlusion += 0.35
  }

  const staggerBonus = slot.side === 'left' ? 0.05 : 0.08
  return coneScore * (1 - Math.min(0.9, occlusion)) + staggerBonus
}

function violatesProximity(
  rect: Rect,
  category: string | null,
  placed: PatronCentricPlacedObject[],
  gridSpacingFt: number
): boolean {
  if (!category) return false
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  for (const p of placed) {
    if ((p.categoryName ?? null) !== category) continue
    const aabb = rotatedAabb(p as PlacementProbe)
    const ocx = aabb.x + aabb.width / 2
    const ocy = aabb.y + aabb.height / 2
    const dxColumns = Math.abs(cx - ocx) / gridSpacingFt
    const dyRows = Math.abs(cy - ocy) / gridSpacingFt
    if (
      dxColumns < PROXIMITY_MIN_COLUMNS &&
      dyRows < PROXIMITY_MIN_ROWS
    ) {
      return true
    }
  }
  return false
}

function canPlaceProbe(
  probe: PlacementProbe,
  roomWidth: number,
  roomHeight: number,
  obstacles: Rect[],
  placed: PatronCentricPlacedObject[],
  clearanceFt: number
): boolean {
  const aabb = rotatedAabb(probe)
  if (
    aabb.x < WALL_BUFFER_FT - 1e-6 ||
    aabb.y < WALL_BUFFER_FT - 1e-6 ||
    aabb.x + aabb.width > roomWidth - WALL_BUFFER_FT + 1e-6 ||
    aabb.y + aabb.height > roomHeight - WALL_BUFFER_FT + 1e-6
  ) {
    return false
  }
  const padded = expandRect(aabb, clearanceFt)
  for (const obs of obstacles) {
    if (aabbOverlap(padded, obs)) return false
  }
  for (const p of placed) {
    const other = expandRect(rotatedAabb(p as PlacementProbe), clearanceFt)
    if (aabbOverlap(padded, other)) return false
  }
  return true
}

function medianFootprint(
  objects: PatronLayoutObjectInput[]
): { width: number; height: number } {
  const ws = [...objects.map((o) => o.width)].sort((a, b) => a - b)
  const hs = [...objects.map((o) => o.height)].sort((a, b) => a - b)
  const mid = Math.floor(objects.length / 2)
  return {
    width: roundHalf(ws[mid] ?? 6),
    height: roundHalf(hs[mid] ?? 2),
  }
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function runPlacementPass(
  roomWidth: number,
  roomHeight: number,
  objectsToPlace: PatronLayoutObjectInput[],
  options: Required<
    Pick<
      PatronCentricLayoutOptions,
      | 'corridorWidthFt'
      | 'gridSpacingFt'
      | 'edgeClearanceFt'
      | 'wallInsetFt'
    >
  > & {
    entrance: PatronLayoutPoint
    exit: PatronLayoutPoint
    obstacles: Rect[]
    eventCategoryNames?: ReadonlyArray<string>
    layoutStyle: PatronLayoutStyle
    halfConeCos: number
  }
): PatronCentricLayoutResult {
  const { width: defaultW, height: defaultH } = medianFootprint(objectsToPlace)
  const maxDepth = Math.max(...objectsToPlace.map((o) => o.height), defaultH)

  const pathway = buildPatronPathway(
    roomWidth,
    roomHeight,
    options.entrance,
    options.exit,
    options.corridorWidthFt,
    maxDepth
  )

  const slots = [
    ...generatePatronLayoutSlots(
      roomWidth,
      roomHeight,
      pathway,
      defaultW,
      defaultH,
      {
        corridorWidthFt: options.corridorWidthFt,
        style: options.layoutStyle,
      }
    ),
    ...generateSupplementalSlots(
      roomWidth,
      roomHeight,
      pathway,
      defaultW,
      defaultH
    ),
  ]
  slots.sort((a, b) => a.pathDist - b.pathDist)

  const pathCum = pathCumulativeDistances(pathway)
  const placed: PatronCentricPlacedObject[] = []
  const dropped: PatronLayoutObjectInput[] = []
  let unsatisfiedCategoryCount = 0
  let equitySum = 0
  let equityCount = 0

  const categoryCount = options.eventCategoryNames?.length ?? 0
  const categoryUseCount = new Map<string, number>()
  let categoryRotor = 0
  if (options.eventCategoryNames) {
    for (const name of options.eventCategoryNames) {
      categoryUseCount.set(name, 0)
    }
  }

  function pickCategory(
    rect: Rect
  ): { category: string | null; advanceBy: number } {
    if (categoryCount === 0) return { category: null, advanceBy: 0 }
    const candidates: Array<{ name: string; rotorIdx: number }> = []
    for (let i = 0; i < categoryCount; i++) {
      const idx = (categoryRotor + i) % categoryCount
      candidates.push({ name: options.eventCategoryNames![idx]!, rotorIdx: i })
    }
    candidates.sort((a, b) => {
      const ua = categoryUseCount.get(a.name) ?? 0
      const ub = categoryUseCount.get(b.name) ?? 0
      if (ua !== ub) return ua - ub
      return a.rotorIdx - b.rotorIdx
    })
    for (const cand of candidates) {
      if (!violatesProximity(rect, cand.name, placed, options.gridSpacingFt)) {
        return { category: cand.name, advanceBy: cand.rotorIdx + 1 }
      }
    }
    return { category: null, advanceBy: 1 }
  }

  for (const src of objectsToPlace) {
    const boothW = roundHalf(src.width)
    const boothH = roundHalf(src.height)
    let best: {
      slot: LayoutSlot
      score: number
      probe: PlacementProbe
      category: string | null
      advanceBy: number
    } | null = null

    for (const slot of slots) {
      const probe = probeFromPlacement(
        slot.x,
        slot.y,
        boothW,
        boothH,
        slot.rotation,
        src.id
      )
      if (
        !canPlaceProbe(
          probe,
          roomWidth,
          roomHeight,
          options.obstacles,
          placed,
          options.edgeClearanceFt
        )
      ) {
        continue
      }

      const aabb = rotatedAabb(probe)
      const { category, advanceBy } = pickCategory(aabb)

      const { point: pathPoint } = pointAlongPath(
        pathway,
        pathCum,
        slot.pathDist
      )
      const score = visionScoreForSlot(
        slot,
        boothW,
        boothH,
        pathPoint,
        placed,
        options.halfConeCos
      )

      if (!best || score > best.score) {
        best = { slot, score, probe, category, advanceBy }
      }
    }

    if (!best) {
      dropped.push(src)
      continue
    }

    if (categoryCount > 0) {
      categoryRotor =
        (categoryRotor + best.advanceBy) % categoryCount
    }
    const finalCategory =
      categoryCount > 0
        ? best.category
        : src.categoryName ?? null
    if (categoryCount > 0 && !finalCategory) unsatisfiedCategoryCount++
    if (finalCategory) {
      categoryUseCount.set(
        finalCategory,
        (categoryUseCount.get(finalCategory) ?? 0) + 1
      )
    }

    const item: PatronCentricPlacedObject = {
      ...src,
      kind: 'booth',
      x: best.slot.x,
      y: best.slot.y,
      width: boothW,
      height: boothH,
      rotation: best.slot.rotation,
      categoryName: finalCategory,
    }
    placed.push(item)
    equitySum += best.score
    equityCount++
  }

  const visualEquityScore =
    equityCount > 0 ? Math.min(1, equitySum / equityCount) : 0

  return {
    placed,
    dropped,
    visualEquityScore,
    pathway,
    unsatisfiedCategoryCount,
    resolvedStyle: options.layoutStyle,
  }
}

/** Supplemental angled slots for booths that did not fit primary corridor pass. */
function generateSupplementalSlots(
  roomWidth: number,
  roomHeight: number,
  pathway: PatronLayoutPoint[],
  boothWidth: number,
  boothHeight: number
): LayoutSlot[] {
  const cum = pathCumulativeDistances(pathway)
  const total = cum[cum.length - 1] ?? 0
  const stepAlong = boothWidth + BOOTH_EDGE_CLEARANCE_FT * 0.5
  const slots: LayoutSlot[] = []
  const angles = [30, 45, 60]

  for (let dist = stepAlong; dist < total; dist += stepAlong) {
    const { point, tangentDeg, pathDist } = pointAlongPath(pathway, cum, dist)
    for (const side of ['left', 'right'] as const) {
      for (const angleOffset of angles) {
        const rot = normalizeDeg(
          tangentDeg + (side === 'left' ? -angleOffset : angleOffset)
        )
        const t = unitFromDeg(tangentDeg)
        const n = { x: -t.y, y: t.x }
        const sign = side === 'left' ? 1 : -1
        const distOff =
          PATRON_CORRIDOR_WIDTH_FT + boothHeight * 1.5 + FRONT_CLEARANCE_FT
        const cx = point.x + n.x * sign * distOff
        const cy = point.y + n.y * sign * distOff
        const { x, y } = boothTopLeftFromCenter(cx, cy, boothWidth, boothHeight)
        slots.push({
          x,
          y,
          rotation: rot,
          pathDist: pathDist + angleOffset * 0.001,
          side,
          tangentDeg: rot,
        })
      }
    }
  }
  return slots
}

/**
 * Patron-first layout: dynamic angles, winding corridor, rotated collision,
 * maximized forward sightline equity.
 */
export function calculatePatronCentricLayout(
  roomWidth: number,
  roomHeight: number,
  objectsToPlace: PatronLayoutObjectInput[],
  options: PatronCentricLayoutOptions = {}
): PatronCentricLayoutResult {
  if (objectsToPlace.length === 0) {
    return {
      placed: [],
      dropped: [],
      visualEquityScore: 0,
      pathway: [],
      unsatisfiedCategoryCount: 0,
      resolvedStyle: options.layoutStyle ?? 'adaptive',
    }
  }

  const corridorWidthFt = options.corridorWidthFt ?? PATRON_CORRIDOR_WIDTH_FT
  const visionConeDeg = options.visionConeDeg ?? PATRON_VISION_CONE_DEG
  const halfConeCos = Math.cos((visionConeDeg / 2) * (Math.PI / 180))
  const gridSpacingFt = options.gridSpacingFt ?? 1
  const edgeClearanceFt =
    options.edgeClearanceFt ?? BOOTH_EDGE_CLEARANCE_FT
  const wallInsetFt = options.wallInsetFt ?? WALL_BUFFER_FT
  void wallInsetFt

  const entrance = options.entrance ?? {
    x: roomWidth / 2,
    y: roomHeight - WALL_BUFFER_FT,
  }
  const exit = options.exit ?? {
    x: roomWidth / 2,
    y: WALL_BUFFER_FT + 2,
  }
  const obstacles = options.obstacles ?? []
  const layoutStyle = options.layoutStyle ?? 'adaptive'

  const baseOpts = {
    entrance,
    exit,
    obstacles,
    corridorWidthFt,
    gridSpacingFt,
    edgeClearanceFt,
    wallInsetFt: WALL_BUFFER_FT,
    eventCategoryNames: options.eventCategoryNames,
    halfConeCos,
  }

  const resolvedStyle: PatronLayoutStyle =
    layoutStyle === 'adaptive' ? 'chevron-45' : layoutStyle

  return runPlacementPass(roomWidth, roomHeight, objectsToPlace, {
    ...baseOpts,
    layoutStyle: resolvedStyle,
  })
}
