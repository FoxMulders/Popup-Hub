import type { BoothCell, VenueElement } from '@/types/database'
import { buildWalkwayCells } from '@/lib/booth-planner/accessible-placement'
import { clearanceRingCells } from '@/lib/booth-planner/co-generated-aisles'
import { BOOTH_SAFETY_BUFFER_CELLS } from '@/lib/booth-planner/layout-clearance-constants'
import {
  computeInteriorBounds,
  indoorVerticalAisleColumns,
} from '@/lib/booth-planner/indoor-corridor-layout'
import { isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'
import { sharedAisleRowsToPaint } from '@/lib/booth-planner/shared-aisle'
import { cellKey } from '@/lib/booth-planner/venue-elements'

export interface PatronPathPoint {
  row: number
  col: number
}

export interface PatronPathArrow {
  row: number
  col: number
  /** Radians — 0 = east, π/2 = south in grid space (row increases south). */
  angle: number
}

export interface PatronPathTrace {
  points: PatronPathPoint[]
  arrows: PatronPathArrow[]
}

const WALKWAY_TYPES = new Set(['aisle', 'entrance', 'exit', 'door'])

export interface PatronPathOptions {
  /** Placed booths — footprint + 2′ clearance ring are impassable. */
  placedCells?: BoothCell[]
  /** Route terminus — default follows exit; shopper maps use the stage annex. */
  destination?: 'exit' | 'stage'
}

/** Cells blocked by structure, perimeter, and booth buffers. */
function buildImpassableKeys(
  rows: number,
  cols: number,
  venueElements: VenueElement[],
  placedCells: BoothCell[] = []
): Set<string> {
  const impassable = new Set<string>()

  for (const el of venueElements) {
    if (WALKWAY_TYPES.has(el.type) || el.type === 'stage') continue
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          impassable.add(cellKey(r, c))
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isOuterPerimeterCell(r, c, cols, rows)) {
        impassable.add(cellKey(r, c))
      }
    }
  }

  for (const cell of placedCells) {
    if (cell.col < 0 || cell.row < 0) continue
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          impassable.add(cellKey(r, c))
        }
      }
    }
    for (const { r, c } of clearanceRingCells(
      cell.row,
      cell.col,
      cell.rowSpan,
      cell.colSpan,
      BOOTH_SAFETY_BUFFER_CELLS
    )) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        impassable.add(cellKey(r, c))
      }
    }
  }

  return impassable
}

function buildWalkability(
  rows: number,
  cols: number,
  venueElements: VenueElement[],
  placedCells: BoothCell[] = []
): boolean[][] {
  const impassable = buildImpassableKeys(rows, cols, venueElements, placedCells)
  const walkway = buildWalkwayCells(venueElements)
  const walkable = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c)
      if (impassable.has(key)) continue
      if (walkway.has(key)) {
        walkable[r][c] = true
      }
    }
  }

  return walkable
}

function entranceCenter(
  elements: VenueElement[],
  entrance: 'north' | 'south' | 'east' | 'west'
): PatronPathPoint | null {
  const main = elements.find((e) => e.type === 'entrance')
  if (!main) return null
  const spanC = main.colSpan ?? 1
  const spanR = main.rowSpan ?? 1
  return {
    row: main.row + (spanR - 1) / 2,
    col: main.col + (spanC - 1) / 2,
  }
}

function primaryExitCenter(
  elements: VenueElement[],
  entrance: 'north' | 'south' | 'east' | 'west',
  rows: number,
  cols: number
): PatronPathPoint | null {
  const exits = elements.filter((e) => e.type === 'exit')
  if (exits.length === 0) return null

  const oppositeWall = (el: VenueElement): boolean => {
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    switch (entrance) {
      case 'south':
        return el.row + spanR - 1 >= rows - 2
      case 'north':
        return el.row <= 1
      case 'west':
        return el.col + spanC - 1 >= cols - 2
      case 'east':
        return el.col <= 1
    }
  }

  const candidates = exits.filter(oppositeWall)
  const pool = candidates.length > 0 ? candidates : exits
  let best = pool[0]
  let bestArea = 0
  for (const el of pool) {
    const area = (el.colSpan ?? 1) * (el.rowSpan ?? 1)
    if (area > bestArea) {
      bestArea = area
      best = el
    }
  }

  const spanC = best.colSpan ?? 1
  const spanR = best.rowSpan ?? 1
  return {
    row: best.row + (spanR - 1) / 2,
    col: best.col + (spanC - 1) / 2,
  }
}

function hasStructuredCorridorNetwork(venueElements: VenueElement[]): boolean {
  return venueElements.some(
    (e) =>
      e.type === 'aisle' &&
      (e.label === 'Row aisle' ||
        e.label === 'Shared aisle' ||
        e.label === 'Customer spine aisle')
  )
}

function dedupeConsecutivePoints(points: PatronPathPoint[]): PatronPathPoint[] {
  if (points.length === 0) return points
  const out: PatronPathPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    if (prev.row !== cur.row || prev.col !== cur.col) out.push(cur)
  }
  return out
}

function collectWalkableRowSegment(
  walkable: boolean[][],
  row: number,
  c0: number,
  c1: number,
  reverse: boolean
): PatronPathPoint[] {
  const segment: PatronPathPoint[] = []
  for (let c = c0; c <= c1; c++) {
    if (walkable[row]?.[c]) segment.push({ row, col: c })
  }
  return reverse ? [...segment].reverse() : segment
}

function collectWalkableColSegment(
  walkable: boolean[][],
  col: number,
  r0: number,
  r1: number
): PatronPathPoint[] {
  const segment: PatronPathPoint[] = []
  for (let r = r0; r <= r1; r++) {
    if (walkable[r]?.[col]) segment.push({ row: r, col })
  }
  return segment
}

/** Serpentine waypoints through shared + row aisles so patrons pass vendor storefronts. */
function buildCorridorSerpentineWaypoints(
  cols: number,
  rows: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  walkable: boolean[][],
  start: PatronPathPoint,
  end: PatronPathPoint
): PatronPathPoint[] {
  const bounds = computeInteriorBounds(cols, rows)
  const waypoints: PatronPathPoint[] = [start]

  const westCol = bounds.minCol
  const eastCol = bounds.maxCol
  const sharedRows = sharedAisleRowsToPaint(bounds)
  const rowOrder =
    entrance === 'north' || entrance === 'west' ? sharedRows : [...sharedRows].reverse()

  const startRow = Math.round(start.row)
  const endRow = Math.round(end.row)

  if (rowOrder.length > 0) {
    const firstSharedRow = rowOrder[0]
    const leadInFrom = entrance === 'north' ? Math.min(startRow, firstSharedRow) : startRow
    const leadInTo = entrance === 'north' ? Math.max(startRow, firstSharedRow) : firstSharedRow
    waypoints.push(
      ...collectWalkableColSegment(walkable, westCol, leadInFrom, leadInTo)
    )
  }

  let flip = false
  for (const r of rowOrder) {
    waypoints.push(
      ...collectWalkableRowSegment(walkable, r, bounds.minCol, bounds.maxCol, flip)
    )
    flip = !flip
  }

  const verticalAisleCols = indoorVerticalAisleColumns(cols, bounds)
  if (verticalAisleCols.length > 0 && rowOrder.length > 0) {
    const midAisleCol = verticalAisleCols[Math.floor(verticalAisleCols.length / 2)]
    const lastSharedRow = rowOrder[rowOrder.length - 1]
    waypoints.push(
      ...collectWalkableColSegment(walkable, midAisleCol, lastSharedRow, endRow)
    )
  } else if (rowOrder.length > 0) {
    waypoints.push(...collectWalkableColSegment(walkable, eastCol, rowOrder[rowOrder.length - 1], endRow))
  }

  waypoints.push(end)
  return dedupeConsecutivePoints(waypoints)
}

function connectPatronWaypoints(
  venueElements: VenueElement[],
  cols: number,
  rows: number,
  waypoints: PatronPathPoint[],
  placedCells: BoothCell[]
): PatronPathPoint[] {
  if (waypoints.length < 2) return waypoints

  const full: PatronPathPoint[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg =
      computeWalkableRoute(
        venueElements,
        cols,
        rows,
        waypoints[i],
        waypoints[i + 1],
        placedCells
      ) ?? [waypoints[i], waypoints[i + 1]]
    if (full.length === 0) full.push(...seg)
    else full.push(...seg.slice(1))
  }
  return simplifyPath(full)
}

function computeSerpentineCorridorPatronPath(
  venueElements: VenueElement[],
  cols: number,
  rows: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  options?: PatronPathOptions
): PatronPathTrace | null {
  const placedCells = options?.placedCells ?? []
  const destination = options?.destination ?? 'exit'
  const walkable = buildWalkability(rows, cols, venueElements, placedCells)
  const startCenter = entranceCenter(venueElements, entrance)
  if (!startCenter) return null

  const start =
    getEntranceWalkPoint(venueElements, entrance, walkable, rows, cols) ??
    snapToWalkableCell(startCenter.row, startCenter.col, walkable, rows, cols)
  if (!start) return null

  const end =
    destination === 'stage'
      ? stageApproachPoint(venueElements, walkable, entrance, rows, cols) ??
        primaryExitCenter(venueElements, entrance, rows, cols)
      : primaryExitCenter(venueElements, entrance, rows, cols)
  if (!end) return null

  const endWalk =
    snapToWalkableCell(end.row, end.col, walkable, rows, cols) ?? end
  const waypoints = buildCorridorSerpentineWaypoints(
    cols,
    rows,
    entrance,
    walkable,
    start,
    endWalk
  )
  const points = connectPatronWaypoints(venueElements, cols, rows, waypoints, placedCells)
  if (points.length < 2) return null

  return { points, arrows: arrowsAlongPath(points, 8) }
}

function centerlineWalkwayKeys(elements: VenueElement[]): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type !== 'aisle') continue
    const label = el.label ?? ''
    if (
      /shared aisle|serpentine|cross flow|row aisle|entrance threshold|exit buffer|anchor approach/i.test(
        label
      )
    ) {
      const spanC = el.colSpan ?? 1
      const spanR = el.rowSpan ?? 1
      for (let r = el.row; r < el.row + spanR; r++) {
        for (let c = el.col; c < el.col + spanC; c++) {
          keys.add(cellKey(r, c))
        }
      }
    }
  }
  return keys
}

/** 0-1 weighted BFS — prefers geometric center-line of painted walkways. */
function bfsPathCenterlineBiased(
  walkable: boolean[][],
  centerline: Set<string>,
  start: PatronPathPoint,
  end: PatronPathPoint,
  rows: number,
  cols: number
): PatronPathPoint[] {
  const sr = Math.round(start.row)
  const sc = Math.round(start.col)
  const er = Math.round(end.row)
  const ec = Math.round(end.col)

  if (!walkable[sr]?.[sc]) return [start, end]

  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const startKey = cellKey(sr, sc)
  dist.set(startKey, 0)
  prev.set(startKey, null)

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ]

  const queue: string[] = [startKey]
  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity))
    const key = queue.shift()!
    const [curR, curC] = key.split('-').map(Number)
    if (curR === er && curC === ec) break

    for (const { dr, dc } of dirs) {
      const nr = curR + dr
      const nc = curC + dc
      const nKey = cellKey(nr, nc)
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      if (!walkable[nr][nc]) continue
      const step = centerline.has(nKey) ? 0 : 1
      const next = (dist.get(key) ?? 0) + step
      if (next < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, next)
        prev.set(nKey, key)
        queue.push(nKey)
      }
    }
  }

  const endKey = cellKey(er, ec)
  if (!prev.has(endKey)) return [start, end]

  const path: PatronPathPoint[] = []
  let key: string | null = endKey
  while (key) {
    const [r, c] = key.split('-').map(Number)
    path.push({ row: r, col: c })
    key = prev.get(key) ?? null
  }
  path.reverse()
  return path
}

function bfsPath(
  walkable: boolean[][],
  start: PatronPathPoint,
  end: PatronPathPoint,
  rows: number,
  cols: number
): PatronPathPoint[] {
  const sr = Math.round(start.row)
  const sc = Math.round(start.col)
  const er = Math.round(end.row)
  const ec = Math.round(end.col)

  if (!walkable[sr]?.[sc]) return [start, end]

  const queue: PatronPathPoint[] = [{ row: sr, col: sc }]
  const prev = new Map<string, string | null>()
  prev.set(cellKey(sr, sc), null)

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.row === er && cur.col === ec) break
    for (const { dr, dc } of dirs) {
      const nr = cur.row + dr
      const nc = cur.col + dc
      const key = cellKey(nr, nc)
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      if (!walkable[nr][nc]) continue
      if (prev.has(key)) continue
      prev.set(key, cellKey(cur.row, cur.col))
      queue.push({ row: nr, col: nc })
    }
  }

  const endKey = cellKey(er, ec)
  if (!prev.has(endKey)) return [start, end]

  const path: PatronPathPoint[] = []
  let key: string | null = endKey
  while (key) {
    const [r, c] = key.split('-').map(Number)
    path.push({ row: r, col: c })
    key = prev.get(key) ?? null
  }
  path.reverse()
  return path
}

function simplifyPath(points: PatronPathPoint[]): PatronPathPoint[] {
  if (points.length <= 2) return points
  const out: PatronPathPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    const next = points[i + 1]
    const sameLine =
      (cur.row - prev.row) * (next.col - cur.col) === (cur.col - prev.col) * (next.row - cur.row)
    if (!sameLine) out.push(cur)
  }
  out.push(points[points.length - 1])
  return out
}

function arrowsAlongPath(points: PatronPathPoint[], everyFt = 8): PatronPathArrow[] {
  const arrows: PatronPathArrow[] = []
  let accumulated = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dr = b.row - a.row
    const dc = b.col - a.col
    const segLen = Math.hypot(dr, dc)
    const angle = Math.atan2(dr, dc)
    accumulated += segLen
    if (accumulated >= everyFt) {
      arrows.push({
        row: (a.row + b.row) / 2,
        col: (a.col + b.col) / 2,
        angle,
      })
      accumulated = 0
    }
  }
  return arrows
}

function stageApproachPoint(
  elements: VenueElement[],
  walkable: boolean[][],
  entrance: 'north' | 'south' | 'east' | 'west',
  rows: number,
  cols: number
): PatronPathPoint | null {
  const stage =
    elements.find((e) => /raised stage|performance platform|main stage/i.test(e.label ?? '')) ??
    elements.find((e) => e.type === 'stage')

  if (!stage) return null

  const spanC = stage.colSpan ?? 1
  const spanR = stage.rowSpan ?? 1
  const candidates: PatronPathPoint[] = []

  const pushIfWalkable = (r: number, c: number) => {
    if (r >= 0 && c >= 0 && r < rows && c < cols && walkable[r][c]) {
      candidates.push({ row: r, col: c })
    }
  }

  // Approach from the hall side (opposite the annex / performance edge).
  if (entrance === 'south' || stage.row >= Math.floor(rows / 2)) {
    for (let c = stage.col; c < stage.col + spanC; c++) {
      pushIfWalkable(stage.row - 1, c)
    }
  }
  if (entrance === 'north' || stage.row < Math.floor(rows / 2)) {
    for (let c = stage.col; c < stage.col + spanC; c++) {
      pushIfWalkable(stage.row + spanR, c)
    }
  }
  if (entrance === 'west') {
    for (let r = stage.row; r < stage.row + spanR; r++) {
      pushIfWalkable(r, stage.col + spanC)
    }
  }
  if (entrance === 'east') {
    for (let r = stage.row; r < stage.row + spanR; r++) {
      pushIfWalkable(r, stage.col - 1)
    }
  }

  if (candidates.length === 0) return null

  const entrancePt = entranceCenter(elements, entrance)
  if (!entrancePt) return candidates[0]

  let best = candidates[0]
  let bestDist = Infinity
  for (const pt of candidates) {
    const d = Math.hypot(pt.row - entrancePt.row, pt.col - entrancePt.col)
    if (d < bestDist) {
      bestDist = d
      best = pt
    }
  }
  return best
}

/** Walkable grid route between two points (for booth spurs off the main patron path). */
export function computeWalkableRoute(
  venueElements: VenueElement[],
  cols: number,
  rows: number,
  start: PatronPathPoint,
  end: PatronPathPoint,
  placedCells: BoothCell[] = []
): PatronPathPoint[] | null {
  const walkable = buildWalkability(rows, cols, venueElements, placedCells)
  const centerline = centerlineWalkwayKeys(venueElements)
  const raw =
    centerline.size > 0
      ? bfsPathCenterlineBiased(walkable, centerline, start, end, rows, cols)
      : bfsPath(walkable, start, end, rows, cols)
  const points = simplifyPath(raw)
  return points.length >= 2 ? points : null
}

/** Route from entrance center through walkable aisles to primary exit, avoiding booth buffers. */
export function computePatronPathTrace(
  venueElements: VenueElement[],
  cols: number,
  rows: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  options?: PatronPathOptions
): PatronPathTrace | null {
  if (hasStructuredCorridorNetwork(venueElements)) {
    const serpentine = computeSerpentineCorridorPatronPath(
      venueElements,
      cols,
      rows,
      entrance,
      options
    )
    if (serpentine) return serpentine
  }

  const placedCells = options?.placedCells ?? []
  const destination = options?.destination ?? 'exit'
  const start = entranceCenter(venueElements, entrance)
  if (!start) return null

  const walkable = buildWalkability(rows, cols, venueElements, placedCells)
  const end =
    destination === 'stage'
      ? stageApproachPoint(venueElements, walkable, entrance, rows, cols) ??
        primaryExitCenter(venueElements, entrance, rows, cols)
      : primaryExitCenter(venueElements, entrance, rows, cols)
  if (!end) return null

  const centerline = centerlineWalkwayKeys(venueElements)
  const raw =
    centerline.size > 0
      ? bfsPathCenterlineBiased(walkable, centerline, start, end, rows, cols)
      : bfsPath(walkable, start, end, rows, cols)
  const points = simplifyPath(raw)
  if (points.length < 2) return null

  const arrows = arrowsAlongPath(points, 8)
  return { points, arrows }
}

/** Walkability grid for shopper pathfinding (aisle cells only). */
export function buildWalkabilityGrid(
  rows: number,
  cols: number,
  venueElements: VenueElement[],
  placedCells: BoothCell[] = []
): boolean[][] {
  return buildWalkability(rows, cols, venueElements, placedCells)
}

export function getCenterlineWalkwayKeys(venueElements: VenueElement[]): Set<string> {
  return centerlineWalkwayKeys(venueElements)
}

/** Snap a grid coordinate to the nearest walkable aisle cell. */
export function snapToWalkableCell(
  row: number,
  col: number,
  walkable: boolean[][],
  rows: number,
  cols: number
): PatronPathPoint | null {
  const sr = Math.round(row)
  const sc = Math.round(col)
  if (sr >= 0 && sc >= 0 && sr < rows && sc < cols && walkable[sr][sc]) {
    return { row: sr, col: sc }
  }

  const queue: PatronPathPoint[] = [{ row: sr, col: sc }]
  const seen = new Set<string>([cellKey(sr, sc)])
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (
      cur.row >= 0 &&
      cur.col >= 0 &&
      cur.row < rows &&
      cur.col < cols &&
      walkable[cur.row][cur.col]
    ) {
      return cur
    }
    for (const { dr, dc } of dirs) {
      const nr = cur.row + dr
      const nc = cur.col + dc
      const key = cellKey(nr, nc)
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen.has(key)) continue
      seen.add(key)
      queue.push({ row: nr, col: nc })
    }
  }
  return null
}

export function getEntranceWalkPoint(
  venueElements: VenueElement[],
  entrance: 'north' | 'south' | 'east' | 'west',
  walkable: boolean[][],
  rows: number,
  cols: number
): PatronPathPoint | null {
  const center = entranceCenter(venueElements, entrance)
  if (!center) return null
  return snapToWalkableCell(center.row, center.col, walkable, rows, cols)
}

export function buildPathTrace(points: PatronPathPoint[]): PatronPathTrace | null {
  const simplified = simplifyPath(points)
  if (simplified.length < 2) return null
  return { points: simplified, arrows: arrowsAlongPath(simplified, 8) }
}

/** Local patron-flow direction at a grid cell (nearest path segment). */
export function patronPathFlowVectorAt(
  row: number,
  col: number,
  trace: PatronPathTrace
): { dr: number; dc: number } | null {
  const points = trace.points
  if (points.length < 2) return null

  const pr = row + 0.5
  const pc = col + 0.5
  let bestDistSq = Infinity
  let best: { dr: number; dc: number } | null = null

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const ar = a.row + 0.5
    const ac = a.col + 0.5
    const br = b.row + 0.5
    const bc = b.col + 0.5
    const segDr = br - ar
    const segDc = bc - ac
    const segLenSq = segDr * segDr + segDc * segDc
    if (segLenSq === 0) continue

    const t = Math.max(
      0,
      Math.min(1, ((pr - ar) * segDr + (pc - ac) * segDc) / segLenSq)
    )
    const projR = ar + t * segDr
    const projC = ac + t * segDc
    const distSq = (pr - projR) ** 2 + (pc - projC) ** 2
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      const mag = Math.hypot(segDr, segDc)
      best = mag > 0 ? { dr: segDr / mag, dc: segDc / mag } : null
    }
  }

  return best
}

/** Validate all path points lie on walkway cells. */
export function patronPathIsWalkable(
  trace: PatronPathTrace,
  venueElements: VenueElement[],
  rows: number,
  cols: number
): boolean {
  const walkway = buildWalkwayCells(venueElements)
  return trace.points.every(({ row, col }) => {
    const r = Math.round(row)
    const c = Math.round(col)
    return r >= 0 && c >= 0 && r < rows && c < cols && walkway.has(cellKey(r, c))
  })
}
