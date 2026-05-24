/**
 * Shopper routing smoke tests — run: npm run test:shopper-routing
 */
import { autoLayout } from '@/lib/booth-planner/algorithm'
import { applyIndoorCorridorLayout } from '@/lib/booth-planner/indoor-corridor-layout'
import {
  buildWalkabilityGrid,
  getCenterlineWalkwayKeys,
  getEntranceWalkPoint,
  patronPathIsWalkable,
} from '@/lib/booth-planner/patron-path-trace'
import { buildDefaultVenueElements } from '@/lib/booth-planner/venue-elements'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import {
  computeShopperPatronPath,
  resolveShopperRouteTrace,
} from '@/lib/shopper/layout'
import { getRoomCanvasMetrics } from '@/lib/shopper/room-canvas'
import {
  astarWalkRoute,
  boothApproachNode,
  computeExpositionTourRoute,
  computeVendorDirectRoute,
} from '@/lib/shopper/pathfinding'
import type { BoothCell, LayoutRoom } from '@/types/database'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function buildCorridorTestRoom(vendorCount: number): LayoutRoom {
  const cols = 40
  const rows = 35
  const base = buildDefaultVenueElements('south', cols, rows)
  const shell = applyIndoorCorridorLayout(cols, rows, 'south', base)
  const layout = autoLayout({
    venueWidth: cols,
    venueLength: rows,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: shell.venue_elements,
    vendors: Array.from({ length: vendorCount }, (_, i) => ({
      id: `shopper-qa-${i}`,
      vendorName: i === 0 ? 'Books & Stationery 1' : `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Books' : 'Food',
      categoryColor: '#2D5A27',
      colSpan: 6,
      rowSpan: 2,
      tableLengthFt: 6,
    })),
    fcfsOrder: true,
    preset: 'outdoor',
    useIndoorCorridor: true,
    coGenerateAisles: false,
  })

  return {
    id: 'test-main',
    name: 'Corridor Test Hall',
    venue_width: cols,
    venue_length: rows,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells: layout.cells,
    venue_elements: layout.venueElements,
  }
}

function pathContainsCell(
  points: { row: number; col: number }[],
  target: { row: number; col: number }
): boolean {
  const key = cellKey(target.row, target.col)
  return points.some((p) => cellKey(Math.round(p.row), Math.round(p.col)) === key)
}

function runAstarUnitTests(): void {
  const rows = 5
  const cols = 5
  const walkable = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true))
  walkable[2][1] = false
  walkable[2][2] = false
  walkable[2][3] = false

  const path = astarWalkRoute(
    walkable,
    { row: 2, col: 0 },
    { row: 2, col: 4 },
    rows,
    cols
  )
  assert(path != null, 'A* should find a path around a wall segment')
  assert(path!.length >= 5, 'A* path should detour around obstacle')
  assert(
    !path!.some((p) => p.row === 2 && p.col >= 1 && p.col <= 3),
    'A* path must not cross blocked cells'
  )

  const blocked = astarWalkRoute(
    walkable,
    { row: 0, col: 0 },
    { row: 4, col: 0 },
    rows,
    cols
  )
  assert(blocked != null && blocked.length === 5, 'A* should route straight when unobstructed')

  console.log('✓ A* unit tests passed')
}

function runBaselinePatronFlowTests(room: LayoutRoom): void {
  const metrics = getRoomCanvasMetrics(room)
  const trace = computeShopperPatronPath(room)
  assert(trace != null && trace.points.length >= 2, 'Baseline patron flow should produce a path')
  assert(
    patronPathIsWalkable(trace!, metrics.venueElements, metrics.canvasRows, metrics.cols),
    'Baseline patron flow must stay on walkable aisle cells'
  )

  const resolved = resolveShopperRouteTrace(room, 'baseline', null)
  assert(resolved != null, 'resolveShopperRouteTrace(baseline) should return a trace')

  console.log('✓ baseline patron flow tests passed')
}

function runVendorDirectRouteTests(room: LayoutRoom): void {
  const metrics = getRoomCanvasMetrics(room)
  const target =
    metrics.placedCells.find((c) => c.vendorName === 'Books & Stationery 1') ??
    metrics.placedCells[0]
  assert(target != null, 'Test room needs at least one placed vendor')

  const trace = computeVendorDirectRoute(room, target)
  assert(trace != null && trace.points.length >= 2, 'Vendor direct route should exist')

  const walkable = buildWalkabilityGrid(
    metrics.canvasRows,
    metrics.cols,
    metrics.venueElements,
    metrics.placedCells
  )
  const entrance = getEntranceWalkPoint(
    metrics.venueElements,
    room.entrance,
    walkable,
    metrics.canvasRows,
    metrics.cols
  )
  assert(entrance != null, 'South entrance walk point should exist')

  const centerline = getCenterlineWalkwayKeys(metrics.venueElements)
  const approach = boothApproachNode(
    target,
    walkable,
    metrics.canvasRows,
    metrics.cols,
    entrance!,
    centerline
  )
  assert(approach != null, 'Target booth should have an aisle approach node')
  assert(
    pathContainsCell(trace!.points, approach!),
    'Vendor route should reach the booth approach cell'
  )
  assert(
    patronPathIsWalkable(trace!, metrics.venueElements, metrics.canvasRows, metrics.cols),
    'Vendor direct route must stay on walkable aisle cells'
  )

  console.log('✓ vendor direct route tests passed')
}

function runExpositionTourTests(room: LayoutRoom): void {
  const metrics = getRoomCanvasMetrics(room)
  const walkable = buildWalkabilityGrid(
    metrics.canvasRows,
    metrics.cols,
    metrics.venueElements,
    metrics.placedCells
  )
  const entrance = getEntranceWalkPoint(
    metrics.venueElements,
    room.entrance,
    walkable,
    metrics.canvasRows,
    metrics.cols
  )
  assert(entrance != null, 'Entrance required for exposition tour')

  const approaches = metrics.placedCells
    .map((booth) =>
      boothApproachNode(booth, walkable, metrics.canvasRows, metrics.cols, entrance!)
    )
    .filter((n): n is NonNullable<typeof n> => n != null)

  const uniqueApproaches = new Set(approaches.map((a) => cellKey(a.row, a.col)))
  assert(uniqueApproaches.size >= 3, 'Exposition test needs multiple vendor approach nodes')

  const trace = computeExpositionTourRoute(room)
  assert(trace != null && trace.points.length >= uniqueApproaches.size, 'Exposition tour should exist')

  for (const approach of approaches) {
    assert(
      pathContainsCell(trace!.points, approach),
      `Exposition tour must visit approach cell ${approach.row},${approach.col}`
    )
  }

  assert(
    patronPathIsWalkable(trace!, metrics.venueElements, metrics.canvasRows, metrics.cols),
    'Exposition tour must stay on walkable aisle cells'
  )

  const centerline = getCenterlineWalkwayKeys(metrics.venueElements)
  const baselineLen = computeShopperPatronPath(room)?.points.length ?? 0
  const expoLen = trace!.points.length
  assert(
    expoLen > baselineLen,
    'Exposition tour should be longer than baseline patron flow when multiple vendors exist'
  )
  assert(centerline.size > 0, 'Centerline keys should exist for corridor layouts')

  console.log(`✓ exposition tour tests passed (${uniqueApproaches.size} stops, ${expoLen} path cells)`)
}

export function runShopperPathfindingQa(): void {
  runAstarUnitTests()

  const room = buildCorridorTestRoom(12)
  assert(room.cells.length >= 8, 'Corridor auto-plan should place vendors for routing QA')

  runBaselinePatronFlowTests(room)
  runVendorDirectRouteTests(room)
  runExpositionTourTests(room)

  console.log('✓ all shopper pathfinding QA passed')
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('qa-pathfinding')) {
  runShopperPathfindingQa()
}
