/**
 * Dev/CI layout math smoke tests — run: npx tsx lib/booth-planner/qa-scenarios.ts
 */
import { autoLayout } from '@/lib/booth-planner/algorithm'
import { validateAutoLayoutPlacement } from '@/lib/booth-planner/layout-validation'
import { applyGenericRowLayout, type GenericRowLayoutMode } from '@/lib/booth-planner/generic-row-layouts'
import {
  blockedCellKeys,
  buildDefaultVenueElements,
  clearRemovableFixtures,
} from '@/lib/booth-planner/venue-elements'
import { compareFcfsApplicationOrder } from '@/lib/applications/fcfs-sort'
import {
  CELL_LOCK,
  CELL_WALL,
  SpatialBitGrid,
} from '@/lib/booth-planner/spatial-bitmap'
import { buildEntranceExitOnlyElements } from '@/lib/booth-planner/co-generated-aisles'
import { resolveBoothSpansAtOrigin } from '@/lib/booth-planner/perimeter-orientation'
import { applyOutsideOnlyLayout, buildOutsideOnlyVenueElements } from '@/lib/booth-planner/outside-only-layout'
import {
  applyOutdoorMarketLayout,
  buildClusterPlacementOrder,
  buildOutdoorMarketShell,
  isClusterPlacement,
  isOutdoorClusterCell,
} from '@/lib/booth-planner/outdoor-market-shell'
import {
  cellsOfElement,
  isOuterPerimeterCell,
  isPerimeterVendingLaneCell,
} from '@/lib/booth-planner/perimeter-clearance'
import { perimeterWallAt } from '@/lib/booth-planner/perimeter-wall-segments'
import { detectLayoutOverlaps } from '@/lib/booth-planner/layout-overlap'
import {
  buildVenueElementsFromPreset,
  buildPresetSpatialBitmap,
  canonicalPresetElementSignature,
  fullVenueElementsFromPreset,
  KILKENNY_COMMUNITY_HALL,
  migrateRoomToCurrentPreset,
  resetRoomToPresetBlueprint,
  getOffFloorZonesForPreset,
} from '@/lib/booth-planner/venue-presets'
import {
  buildSmartPopulateLimits,
  calculateNetUsableFloorSpace,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import {
  applyIndoorCorridorLayout,
  hallHasIndoorShell,
} from '@/lib/booth-planner/indoor-corridor-layout'
import { analyzeStrollerClearance } from '@/lib/booth-planner/stroller-clearance'
import { resolveAutoPlanStrategy } from '@/lib/booth-planner/auto-plan-strategy'
import {
  boothHasAisleFrontage,
  buildWalkwayCells,
} from '@/lib/booth-planner/accessible-placement'
import {
  computePatronPathTrace,
  patronPathIsWalkable,
} from '@/lib/booth-planner/patron-path-trace'
import type { BoothCell, VenueElement } from '@/types/database'
import {
  buildMultiSlotMembersFromApprovedApps,
  groupMultiSlotTableVendorsForPlan,
} from '@/lib/booth-planner/approved-application-groups'
import {
  bufferRingsOverlap,
  computeDualRingOverlay,
} from '@/lib/booth-planner/clearance-ring-overlay'

function assertAllBoothsHaveAisleFrontage(
  cells: BoothCell[],
  venueElements: VenueElement[],
  rows: number,
  cols: number,
  label: string
) {
  const walkway = buildWalkwayCells(venueElements)
  for (const cell of cells.filter((c) => c.col >= 0)) {
    const r1 = cell.row + cell.rowSpan - 1
    const c1 = cell.col + cell.colSpan - 1
    assert(
      boothHasAisleFrontage(cell.row, cell.col, r1, c1, rows, cols, walkway),
      `${label}: booth ${cell.vendorName} at ${cell.row}-${cell.col} must face an aisle`
    )
  }
}

function runCorridorAutoPlan(
  cols: number,
  rows: number,
  vendorCount: number,
  baseElements: VenueElement[]
) {
  const shell = applyIndoorCorridorLayout(cols, rows, 'south', baseElements)
  return autoLayout({
    venueWidth: cols,
    venueLength: rows,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: shell.venue_elements,
    vendors: Array.from({ length: vendorCount }, (_, i) => ({
      id: `corridor-${cols}x${rows}-${i}`,
      vendorName: `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Makers' : 'Food',
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
}

function runGenericRowAutoPlan(
  mode: GenericRowLayoutMode,
  cols: number,
  rows: number,
  vendorCount: number,
  baseElements: VenueElement[]
) {
  const shell = applyGenericRowLayout(mode, cols, rows, 'south', baseElements)
  return autoLayout({
    venueWidth: cols,
    venueLength: rows,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: shell.venue_elements,
    vendors: Array.from({ length: vendorCount }, (_, i) => ({
      id: `${mode}-${cols}x${rows}-${i}`,
      vendorName: `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Makers' : 'Food',
      categoryColor: '#2D5A27',
      colSpan: 6,
      rowSpan: 2,
      tableLengthFt: 6,
    })),
    fcfsOrder: true,
    preset: mode,
    useIndoorCorridor: mode === 'snake',
    coGenerateAisles: false,
  })
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runLayoutQaScenarios(): void {
  // FCFS tie-break: same timestamp → lower id wins
  assert(
    compareFcfsApplicationOrder(
      { id: 'aaa', appliedAt: '2026-01-01T12:00:00Z' },
      { id: 'bbb', appliedAt: '2026-01-01T12:00:00Z' }
    ) < 0,
    'FCFS tie-break should use application id'
  )

  // Narrow 15ft-wide hallway — should not throw; may place 0+ on wall
  const narrow = autoLayout({
    venueWidth: 15,
    venueLength: 60,
    boothWidth: 10,
    boothLength: 10,
    entrance: 'south',
    venueElements: buildDefaultVenueElements('south', 1, 6),
    vendors: [
      {
        id: 'v1',
        vendorName: 'A',
        categoryName: 'Makers',
        categoryColor: '#2D5A27',
        colSpan: 1,
        rowSpan: 1,
      },
    ],
    fcfsOrder: true,
  })
  assert(Array.isArray(narrow.cells), 'Narrow venue auto-layout should return cells')

  const placed = narrow.cells.filter((c) => c.col >= 0)
  if (placed.length > 0) {
    const blocked = blockedCellKeys(buildDefaultVenueElements('south', 1, 6))
    const check = validateAutoLayoutPlacement({
      cells: narrow.cells,
      rows: 6,
      cols: 1,
      blocked,
      venueElements: buildDefaultVenueElements('south', 1, 6),
    })
    assert(check.valid, `Narrow placement invalid: ${check.violations.join('; ')}`)
  }

  // Bitmask grid rejects overlapping booth footprints
  const shell = buildEntranceExitOnlyElements('south', 40, 40)
  const packed = autoLayout({
    venueWidth: 40,
    venueLength: 40,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: shell,
    vendors: [
      { id: 'a', vendorName: 'A', categoryName: 'Makers', categoryId: 'makers', categoryColor: '#2D5A27', colSpan: 6, rowSpan: 2 },
      { id: 'b', vendorName: 'B', categoryName: 'Makers', categoryId: 'makers', categoryColor: '#2D5A27', colSpan: 6, rowSpan: 2 },
      { id: 'c', vendorName: 'C', categoryName: 'Food', categoryId: 'food', categoryColor: '#C17F24', colSpan: 6, rowSpan: 2 },
    ],
    fcfsOrder: true,
    coGenerateAisles: true,
  })
  const bitmap = SpatialBitGrid.fromLayout(40, 40, packed.venueElements, packed.cells)
  assert(bitmap.countOverlappingPlacements(packed.cells) === 0, 'Spatial bitmap should detect zero overlaps')

  // Perimeter wall rotation: west wall → 2 × L; north wall → L × 2
  const west = resolveBoothSpansAtOrigin(10, 0, 6, 40, 40)
  assert(west.colSpan === 2 && west.rowSpan === 6, 'West perimeter table runs lengthways along wall')
  const north = resolveBoothSpansAtOrigin(32, 5, 6, 40, 40)
  assert(north.colSpan === 6 && north.rowSpan === 2, 'North perimeter table runs lengthways along wall')

  // Outside-only preset: 1-cell wall shell + empty 4′ vending margin
  const outside = buildOutsideOnlyVenueElements(40, 72, 'south')
  const outsidePatch = applyOutsideOnlyLayout(40, 72, 'south')
  assert(outsidePatch.cells.length === 0, 'Outside only wipes booth cells')
  assert(!outside.some((e) => e.type === 'aisle'), 'Outside only has no interior or spine aisles')
  for (const wall of outside.filter((e) => e.type === 'column')) {
    for (const { row, col } of cellsOfElement(wall)) {
      assert(
        isOuterPerimeterCell(row, col, 40, 72),
        `Outside only columns must sit on outer shell only (${row}-${col})`
      )
    }
  }
  assert(outside.filter((e) => e.type === 'column').length <= 8, 'Merged perimeter uses few wall segments')
  assert(perimeterWallAt(outside, 0, 5, 40, 72) != null, 'South outer wall painted')
  assert(
    !outside.some(
      (e) =>
        e.type === 'column' &&
        cellsOfElement(e).some(({ row, col }) => row === 1 && col >= 1 && col <= 38)
    ),
    'Row 1 vending margin stays clear'
  )
  assert(
    !outside.some(
      (e) =>
        e.type === 'column' &&
        cellsOfElement(e).some(({ row, col }) => row === 4 && col >= 1 && col <= 38)
    ),
    'Row 4 vending margin stays clear'
  )
  assert(isPerimeterVendingLaneCell(2, 2, 40, 72), 'Cell 2-2 is in 4′ perimeter lane')
  assert(!isPerimeterVendingLaneCell(10, 20, 40, 72), 'Interior center is outside vending lane')
  const outsideEntrance = outside.find((e) => e.type === 'entrance')
  assert(outsideEntrance?.row === 0, 'Entrance carved on south outer shell')
  assert((outsideEntrance?.colSpan ?? 1) >= 4, 'Entrance uses wide expo-style cutout')

  // Outdoor rows preset: no walls, cluster aisles, dual entrances, amenities
  const outdoor = buildOutdoorMarketShell({ cols: 40, rows: 72, entrance: 'north' })
  const outdoorPatch = applyOutdoorMarketLayout(40, 72, 'north')
  assert(outdoorPatch.cells.length === 0, 'Outdoor rows wipes booth cells')
  assert(!outdoor.some((e) => e.type === 'column'), 'Outdoor shell must not paint fake hall walls')
  assert(outdoor.some((e) => e.type === 'entrance' && e.row === 71), 'Primary entrance on north walkway')
  assert(outdoor.some((e) => e.type === 'door'), 'Secondary entrance via door element')
  assert(outdoor.some((e) => e.type === 'info_desk'), 'Top walkway includes info desk')
  assert(outdoor.some((e) => e.type === 'aisle' && e.label === 'Pedestrian walkway'), 'North pedestrian walkway painted')
  assert(outdoor.some((e) => e.type === 'aisle' && e.label === 'Row aisle'), 'Vertical cluster row aisles painted')
  assert(isOutdoorClusterCell(10, 2, 40, 72), 'West perimeter strip is a cluster vendor zone')
  assert(!isOutdoorClusterCell(10, 20, 40, 72), 'Vertical row aisle blocks interior cluster cell')
  assert(isClusterPlacement(10, 2, 1, 1, 72, 40), 'Single cell on west strip is valid cluster placement')
  const clusterOrder = buildClusterPlacementOrder(40, 72, 'north')
  assert(clusterOrder.length > 100, 'Cluster walk order should cover perimeter + row strips')
  assert(clusterOrder[0][1] <= 4, 'Cluster order starts near west perimeter / entrance')

  const outdoorLayout = autoLayout({
    venueWidth: 40,
    venueLength: 72,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'north',
    venueElements: outdoor,
    vendors: Array.from({ length: 40 }, (_, i) => ({
      id: `o-${i}`,
      vendorName: `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Makers' : 'Food',
      categoryColor: '#2D5A27',
      colSpan: 6,
      rowSpan: 2,
    })),
    fcfsOrder: true,
    preset: 'outdoor',
    coGenerateAisles: true,
  })
  assert(outdoorLayout.placedCount > 0, 'Outdoor rows auto-plan should place vendors in cluster zones')

  // Hard booth collision rejects wall overlap
  const grid = new SpatialBitGrid(10, 10)
  grid.fillRect(2, 2, 2, 2, 0b01, false)
  assert(!grid.canPlaceBoothRect(2, 2, 2, 2), 'Booth cannot overlap wall cells')

  const overlap = detectLayoutOverlaps({
    rows: 20,
    cols: 20,
    venueElements: [],
    cells: [
      {
        id: 'a',
        col: 2,
        row: 2,
        colSpan: 6,
        rowSpan: 2,
        vendorName: 'A',
        categoryName: 'Makers',
        categoryColor: '#2D5A27',
        boothNumber: 1,
        tableLengthFt: 6,
      },
      {
        id: 'b',
        col: 4,
        row: 2,
        colSpan: 6,
        rowSpan: 2,
        vendorName: 'B',
        categoryName: 'Food',
        categoryColor: '#C17F24',
        boothNumber: 2,
        tableLengthFt: 6,
      },
    ],
  })
  assert(overlap.hasOverlap, 'Overlapping booths should be detected')
  assert(overlap.overlapKeys.size > 0, 'Overlap keys should be populated')

  // Kilkenny hall preset: open main hall; bar/kitchen off-floor; stage alcove vendor-usable
  const kilkennyElements = buildVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL)
  const kilkennyFullElements = fullVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL)
  const kilkennyBlocked = blockedCellKeys(kilkennyFullElements)
  assert(perimeterWallAt(kilkennyElements, 0, 5, 40, 72) != null, 'South wall row 0 painted')
  assert(perimeterWallAt(kilkennyElements, 71, 5, 40, 72) != null, 'North wall row 71 painted')
  assert(perimeterWallAt(kilkennyElements, 10, 0, 40, 72) != null, 'West wall col 0 painted')
  assert(perimeterWallAt(kilkennyElements, 10, 39, 40, 72) != null, 'East wall col 39 painted')
  assert(perimeterWallAt(kilkennyElements, 0, 22, 40, 72) == null, 'South entrance cols 18–23 carved from wall')
  const entrance = kilkennyElements.find((e) => e.type === 'entrance')
  assert(entrance?.row === 0 && entrance.col === 18 && entrance.colSpan === 6, 'Main entrance spans south cols 18–23')
  const exits = kilkennyElements.filter((e) => e.type === 'exit')
  assert(
    exits.some((e) => e.col === 39 && e.row === 0 && e.rowSpan === 4),
    'Emergency exit on east wall rows 0–3'
  )
  assert(
    exits.some((e) => e.row === 71 && e.col === 10 && e.colSpan === 20),
    'North wall stage proscenium toward off-floor stage'
  )
  assert(
    exits.some((e) => e.row === 71 && e.col === 8 && e.colSpan === 2),
    'North wall west stage access door'
  )
  assert(
    exits.some((e) => e.row === 71 && e.col === 30 && e.colSpan === 2),
    'North wall east stage access door'
  )
  assert(
    !exits.some((e) => e.col === 39 && e.row === 32),
    'East kitchen/bar hatch must not appear on the hall floor plan'
  )
  assert(
    exits.some((e) => e.col === 0 && e.row === 18 && e.rowSpan === 4),
    'West wall side exit door'
  )
  assert(
    !kilkennyElements.some(
      (e) =>
        e.type === 'column' &&
        e.row >= 1 &&
        e.row <= 4 &&
        e.col >= 1 &&
        e.col <= 38
    ),
    'Inner south vendor ring (rows 1–4) must stay clear of wall fixtures'
  )
  assert(
    !kilkennyBlocked.has('1-1') && !kilkennyBlocked.has('4-4'),
    'Inner clearance cells 1-1 and 4-4 must remain walkable for perimeter vendors'
  )
  assert(
    !kilkennyElements.some((e) => e.label === 'Bar Area' || /kitchen|bar/i.test(e.label ?? '')),
    'Bar/kitchen must not occupy cells inside the main hall grid'
  )
  assert(
    !kilkennyFullElements.some(
      (e) =>
        (e.label === 'Raised Stage' || e.label === 'Stage Stairs') &&
        e.row < KILKENNY_COMMUNITY_HALL.canvasHeight
    ),
    'Stage and stairs must not occupy cells inside the hall — they sit in the north annex past the wall'
  )
  const stageAnnex = kilkennyFullElements.find((e) => e.label === 'Raised Stage')
  assert(stageAnnex?.row === 72 && stageAnnex.col === 10 && stageAnnex.colSpan === 18 && stageAnnex.rowSpan === 6 && stageAnnex.locked === true, 'Raised stage spans north annex rows 72–77 cols 10–27 and is locked')
  const stairsAnnex = kilkennyFullElements.find((e) => e.label === 'Stage Stairs')
  assert(stairsAnnex?.row === 72 && stairsAnnex.col === 28 && stairsAnnex.rowSpan === 6 && stairsAnnex.locked === true, 'Stage stairs locked in north annex east of stage (6′ deep)')
  assert(!kilkennyBlocked.has('72-15'), 'Raised stage annex cells stay vendor-placeable')
  assert(kilkennyBlocked.has('72-30'), 'Stage stairs annex cells stay blocked')
  const offFloor = getOffFloorZonesForPreset('kilkenny')
  assert(
    offFloor.some((z) => z.label === 'Raised Stage' && z.wall === 'north' && z.colSpan === 18),
    'Raised stage should be an off-floor north annex (18′ wide)'
  )
  assert(
    offFloor.some((z) => z.label === 'Stage Stairs' && z.kind === 'stairs'),
    'Stage stairs should be an off-floor north annex east of the proscenium'
  )
  assert(
    !kilkennyBlocked.has('65-10') && !kilkennyBlocked.has('70-20'),
    'North hall interior stays fully open — stage/stairs are off-floor, not in-grid'
  )
  assert(kilkennyBlocked.size > 180, 'Kilkenny preset should block perimeter walls only')

  const kilkennyWithDecor = [
    ...kilkennyFullElements,
    {
      id: 'qa-info-desk',
      type: 'custom_label' as const,
      row: 20,
      col: 20,
      label: 'Info Desk',
      locked: false,
    },
    {
      id: 'qa-temp-sign',
      type: 'custom_label' as const,
      row: 25,
      col: 25,
      label: 'Temporary Signage',
      locked: false,
    },
  ]
  const kilkennyAfterClearFixtures = clearRemovableFixtures(kilkennyWithDecor, 40, 72)
  assert(
    kilkennyAfterClearFixtures.length === kilkennyFullElements.length,
    `Clear Fixtures should drop only user decorations, kept ${kilkennyAfterClearFixtures.length} expected ${kilkennyFullElements.length}`
  )
  assert(
    kilkennyAfterClearFixtures.some((e) => e.type === 'entrance'),
    'Clear Fixtures must preserve main entrance'
  )
  assert(
    kilkennyAfterClearFixtures.filter((e) => e.type === 'exit').length >= 2,
    'Clear Fixtures must preserve emergency exits'
  )
  assert(
    perimeterWallAt(kilkennyAfterClearFixtures, 0, 5, 40, 72) != null &&
      perimeterWallAt(kilkennyAfterClearFixtures, 71, 5, 40, 72) != null,
    'Clear Fixtures must preserve perimeter walls'
  )
  assert(
    kilkennyAfterClearFixtures.some((e) => e.label === 'Raised Stage' && e.row === 72),
    'Clear Fixtures must preserve Kilkenny raised stage annex'
  )
  assert(
    !kilkennyAfterClearFixtures.some((e) => e.label === 'Info Desk' || e.label === 'Temporary Signage'),
    'Clear Fixtures must remove user-painted temporary decorations'
  )

  const kilkennyBitmap = buildPresetSpatialBitmap(KILKENNY_COMMUNITY_HALL)
  assert(kilkennyBitmap.get(0, 5) === CELL_WALL, 'Spatial matrix marks south wall as 0b01')
  assert(
    kilkennyBitmap.get(35, 20) === 0,
    'Main hall interior should stay open for vendor placement'
  )

  const kilkennyLayout = autoLayout({
    venueWidth: 40,
    venueLength: 72,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: kilkennyFullElements,
    vendors: Array.from({ length: 80 }, (_, i) => ({
      id: `k-${i}`,
      vendorName: `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Makers' : 'Food',
      categoryColor: '#2D5A27',
      colSpan: 6,
      rowSpan: 2,
    })),
    fcfsOrder: true,
    coGenerateAisles: true,
  })
  assert(kilkennyLayout.placedCount > 0, 'Kilkenny auto-plan should place at least one vendor')
  const coPlanEntrance = kilkennyLayout.venueElements.find((e) => e.type === 'entrance')
  assert(coPlanEntrance?.row === 0, 'Co-plan preserves south entrance row after preset load')
  const kilkennyCheck = validateAutoLayoutPlacement({
    cells: kilkennyLayout.cells,
    rows: 72,
    cols: 40,
    blocked: kilkennyBlocked,
    venueElements: kilkennyLayout.venueElements,
  })
  assert(kilkennyCheck.valid, `Kilkenny auto-plan invalid: ${kilkennyCheck.violations.join('; ')}`)
  const kilkennyLayoutBitmap = SpatialBitGrid.fromLayout(40, 72, kilkennyLayout.venueElements, kilkennyLayout.cells)
  assert(
    kilkennyLayoutBitmap.countOverlappingPlacements(kilkennyLayout.cells) === 0,
    'Kilkenny preset auto-plan should have zero spatial overlaps'
  )

  // Perimeter seating math: no blank 8′ gross buffer; deduct structure, doors, customer spine only.
  const kilkennyFloor = calculateNetUsableFloorSpace(40, 72, {
    venueElements: kilkennyElements,
    entrance: 'south',
  })
  assert(
    kilkennyFloor.perimeterDeductionSqFt === 0,
    'Perimeter blank buffer must not reduce gross floor area'
  )
  assert(
    kilkennyFloor.structuralDeductionSqFt === 0,
    `Kilkenny hall floor should have no in-grid structural deductions, got ${kilkennyFloor.structuralDeductionSqFt}`
  )
  assert(
    kilkennyFloor.doorDeductionSqFt === 38,
    `Kilkenny entrance + perimeter openings should deduct 38 sq ft, got ${kilkennyFloor.doorDeductionSqFt}`
  )
  assert(
    kilkennyFloor.netUsableSqFt === 2100,
    `Kilkenny net usable should be 2100 sq ft (open hall minus customer spine), got ${kilkennyFloor.netUsableSqFt}`
  )
  const kilkennyCaps = buildSmartPopulateLimits({
    venueWidthFt: 40,
    venueLengthFt: 72,
    venueElements: kilkennyElements,
    entrance: 'south',
    categories: [{ id: '1', name: 'Makers', is_mlm: false } as import('@/types/database').Category],
    allowMlm: false,
  })
  assert(kilkennyCaps.breakdown.cMax === 87, `Kilkenny C_max should be 87 at 6′×4′ units, got ${kilkennyCaps.breakdown.cMax}`)

  const legacyRoom = migrateRoomToCurrentPreset({
    id: 'legacy',
    name: 'Main Hall',
    venue_width: 40,
    venue_length: 72,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    baseline_table_length_ft: 6,
    venue_preset_id: 'kilkenny',
    cells: [],
    venue_elements: [
      {
        id: 'old-bar',
        type: 'food_court',
        row: 60,
        col: 2,
        colSpan: 8,
        rowSpan: 6,
        label: 'Bar Area',
        locked: true,
      },
      {
        id: 'old-stage',
        type: 'stage',
        row: 5,
        col: 12,
        colSpan: 16,
        rowSpan: 8,
        label: 'Raised Stage',
        locked: true,
      },
    ],
  })
  assert(
    !legacyRoom.venue_elements.some(
      (e) =>
        e.label === 'Bar Area' ||
        ((e.label === 'Raised Stage' || e.label === 'Stage Stairs') &&
          e.row < KILKENNY_COMMUNITY_HALL.canvasHeight)
    ),
    'Legacy Kilkenny saves should drop in-hall bar/stage/stairs on migration'
  )
  assert(
    legacyRoom.venue_elements.some((e) => e.label === 'Raised Stage' && e.row === 72),
    'Legacy Kilkenny migration should place raised stage in the north annex grid'
  )

  // Corridor Flow Optimizer — Kilkenny 40×72 × 35 vendors
  const kilkennyCorridorBase = fullVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL)
  assert(hallHasIndoorShell(kilkennyCorridorBase, 40, 72), 'Kilkenny should auto-detect as indoor shell')
  const kilkennyCorridorShell = applyIndoorCorridorLayout(40, 72, 'south', kilkennyCorridorBase)
  assert(kilkennyCorridorShell.cells.length === 0, 'Corridor shell clears booth cells')
  assert(
    kilkennyCorridorShell.venue_elements.some((e) => e.type === 'column'),
    'Corridor shell preserves perimeter walls'
  )
  assert(
    kilkennyCorridorShell.venue_elements.some((e) => e.type === 'aisle' && e.label === 'Row aisle'),
    'Corridor shell paints vertical row aisles'
  )
  assert(
    kilkennyCorridorShell.venue_elements.some((e) => e.label === 'Raised Stage' && e.row === 72),
    'Corridor shell preserves north annex stage'
  )

  assert(
    kilkennyCorridorShell.venue_elements.some((e) => e.type === 'aisle' && e.label === 'Shared aisle'),
    'Corridor shell paints merged 2′+2′ shared row aisles'
  )

  const kilkennyCorridor35 = runCorridorAutoPlan(40, 72, 35, kilkennyCorridorBase)
  assert(kilkennyCorridor35.placedCount === 35, `Kilkenny corridor expects 35/35 placed, got ${kilkennyCorridor35.placedCount}`)
  assert(kilkennyCorridor35.unplacedCount === 0, 'Kilkenny corridor should have zero unplaced vendors')
  const kilkennyCorridorOverlap = detectLayoutOverlaps({
    rows: 72,
    cols: 40,
    venueElements: kilkennyCorridor35.venueElements,
    cells: kilkennyCorridor35.cells,
  })
  assert(!kilkennyCorridorOverlap.hasOverlap, 'Kilkenny corridor layout must have zero overlaps')
  const kilkennyCorridorClearance = analyzeStrollerClearance({
    rows: 72,
    cols: 40,
    boothWidthFt: 1,
    boothLengthFt: 1,
    cells: kilkennyCorridor35.cells,
    venueElements: kilkennyCorridor35.venueElements,
  })
  assert(
    !kilkennyCorridorClearance.hasBottleneck,
    `Kilkenny corridor should have zero stroller bottlenecks, got ${kilkennyCorridorClearance.bottleneckKeys.size}`
  )

  // Smart Populate (default preset) on indoor halls must route through corridor grammar.
  const defaultIndoorStrategy = resolveAutoPlanStrategy({
    layoutPreset: 'default',
    gridCols: 40,
    gridRows: 72,
    entrance: 'south',
    venueElementsWithDoors: kilkennyCorridorBase,
    isOneFootGrid: true,
  })
  assert(defaultIndoorStrategy.useCorridor, 'Default preset on Kilkenny should auto-enable corridor rows')
  assert(!defaultIndoorStrategy.coGenerateAisles, 'Indoor halls should not co-generate aisles on open floor')
  const defaultIndoor35 = autoLayout({
    venueWidth: 40,
    venueLength: 72,
    boothWidth: 1,
    boothLength: 1,
    entrance: 'south',
    venueElements: defaultIndoorStrategy.venueElementsForPlan,
    vendors: Array.from({ length: 35 }, (_, i) => ({
      id: `default-indoor-${i}`,
      vendorName: `Vendor ${i}`,
      categoryName: i % 2 === 0 ? 'Amway' : 'Macrame & Weaving',
      categoryColor: '#2D5A27',
      colSpan: 6,
      rowSpan: 2,
      tableLengthFt: 6,
    })),
    fcfsOrder: true,
    preset: defaultIndoorStrategy.effectivePreset,
    useIndoorCorridor: defaultIndoorStrategy.useCorridor,
    coGenerateAisles: defaultIndoorStrategy.coGenerateAisles,
  })
  assert(defaultIndoor35.placedCount === 35, `Default indoor smart populate expects 35/35, got ${defaultIndoor35.placedCount}`)
  const defaultIndoorClearance = analyzeStrollerClearance({
    rows: 72,
    cols: 40,
    boothWidthFt: 1,
    boothLengthFt: 1,
    cells: defaultIndoor35.cells,
    venueElements: defaultIndoor35.venueElements,
  })
  assert(
    !defaultIndoorClearance.hasBottleneck,
    `Default indoor smart populate should have zero stroller bottlenecks, got ${defaultIndoorClearance.bottleneckKeys.size}`
  )

  assertAllBoothsHaveAisleFrontage(
    kilkennyCorridor35.cells,
    kilkennyCorridor35.venueElements,
    72,
    40,
    'Kilkenny corridor'
  )
  const kilkennyPatronPath = computePatronPathTrace(kilkennyCorridor35.venueElements, 40, 72, 'south')
  assert(kilkennyPatronPath != null && kilkennyPatronPath.points.length > 0, 'Kilkenny patron path should exist')
  assert(
    patronPathIsWalkable(kilkennyPatronPath!, kilkennyCorridor35.venueElements, 72, 40),
    'Kilkenny patron path must stay on walkable cells'
  )

  for (const mode of ['vertical_rows', 'horizontal_rows', 'snake'] as const) {
    const shell = applyGenericRowLayout(mode, 40, 72, 'south', kilkennyCorridorBase)
    assert(shell.cells.length === 0, `${mode} preset shell clears booth cells`)
    assert(
      shell.venue_elements.some((e) => e.type === 'column'),
      `${mode} shell preserves perimeter walls`
    )
    assert(
      shell.venue_elements.some((e) => e.label === 'Raised Stage' && e.row === 72),
      `${mode} shell preserves north annex stage`
    )
    const layout = runGenericRowAutoPlan(mode, 40, 72, 35, kilkennyCorridorBase)
    assert(layout.placedCount > 0, `${mode} auto-plan should place vendors on Kilkenny`)
    const overlap = detectLayoutOverlaps({
      rows: 72,
      cols: 40,
      venueElements: layout.venueElements,
      cells: layout.cells,
    })
    assert(!overlap.hasOverlap, `${mode} layout must have zero overlaps`)
    const clearance = analyzeStrollerClearance({
      rows: 72,
      cols: 40,
      boothWidthFt: 1,
      boothLengthFt: 1,
      cells: layout.cells,
      venueElements: layout.venueElements,
    })
    assert(
      !clearance.hasBottleneck,
      `${mode} should have zero stroller bottlenecks, got ${clearance.bottleneckKeys.size}`
    )
  }

  // Clear Canvas — absolute flush restores pristine preset; strips corridor + user paint
  const kilkennyPristineSig = canonicalPresetElementSignature(
    fullVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL)
  )
  const corridorPainted = applyIndoorCorridorLayout(40, 72, 'south', fullVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL))
  const corridorWithUserPaint: VenueElement[] = [
    ...corridorPainted.venue_elements,
    {
      id: 'user-label',
      type: 'custom_label',
      row: 10,
      col: 10,
      colSpan: 1,
      rowSpan: 1,
      label: 'Snack Zone',
    },
  ]
  assert(
    corridorWithUserPaint.some((e) => e.type === 'aisle' && e.label === 'Row aisle'),
    'Setup: corridor shell should include row aisles before clear'
  )
  const kilkennyReset = resetRoomToPresetBlueprint('kilkenny', 40, 72)
  assert(kilkennyReset.cells.length === 0, 'Clear canvas must wipe all booth cells')
  assert(
    canonicalPresetElementSignature(kilkennyReset.venue_elements) === kilkennyPristineSig,
    'Clear canvas must restore pristine Kilkenny preset geometry'
  )
  assert(
    !kilkennyReset.venue_elements.some((e) => e.type === 'aisle' && e.label === 'Row aisle'),
    'Clear canvas must strip corridor row aisles'
  )
  assert(
    !kilkennyReset.venue_elements.some((e) => e.label === 'Snack Zone'),
    'Clear canvas must strip user-painted custom labels'
  )
  const blankReset = resetRoomToPresetBlueprint('blank', 40, 72)
  assert(blankReset.cells.length === 0 && blankReset.venue_elements.length === 0, 'Blank clear must empty fixtures')

  // Generic corridor matrix — indoor shells at two sizes × vendor counts
  for (const [cols, rows] of [
    [40, 72],
    [50, 50],
  ] as const) {
    for (const vendorCount of [20, 35]) {
      const baseElements =
        cols === 40 && rows === 72
          ? fullVenueElementsFromPreset(KILKENNY_COMMUNITY_HALL)
          : buildOutsideOnlyVenueElements(cols, rows, 'south')
      assert(hallHasIndoorShell(baseElements, cols, rows), `${cols}×${rows} hall should have indoor shell`)
      const result = runCorridorAutoPlan(cols, rows, vendorCount, baseElements)
      assert(result.placedCount > 0, `${cols}×${rows} corridor should place vendors (${vendorCount} requested)`)
      const overlap = detectLayoutOverlaps({
        rows,
        cols,
        venueElements: result.venueElements,
        cells: result.cells,
      })
      assert(!overlap.hasOverlap, `${cols}×${rows} corridor must not overlap booths`)
      assertAllBoothsHaveAisleFrontage(result.cells, result.venueElements, rows, cols, `${cols}×${rows} corridor`)
      const path = computePatronPathTrace(result.venueElements, cols, rows, 'south')
      assert(path != null && path.points.length > 0, `${cols}×${rows} corridor patron path should exist`)
    }
  }

  console.log('✓ layout QA scenarios passed')
}

function runMultiSlotAndClearanceQa() {
  const apps = [
    {
      id: 'app-a1',
      vendor_id: 'vendor-a',
      category_id: 'cat-1',
      applied_at: '2026-01-01T10:00:00Z',
      vendor: { full_name: 'Alpha Vendor' },
      passport: { business_name: 'Alpha Studio' },
      category: { name: 'Jewelry' },
    },
    {
      id: 'app-a2',
      vendor_id: 'vendor-a',
      category_id: 'cat-1',
      applied_at: '2026-01-02T10:00:00Z',
      vendor: { full_name: 'Alpha Vendor' },
      passport: { business_name: 'Alpha Studio' },
      category: { name: 'Jewelry' },
    },
    {
      id: 'app-b1',
      vendor_id: 'vendor-b',
      category_id: 'cat-2',
      applied_at: '2026-01-03T10:00:00Z',
      vendor: { full_name: 'Beta Vendor' },
      passport: null,
      category: { name: 'Pottery' },
    },
  ]

  const members = buildMultiSlotMembersFromApprovedApps(apps, () => 6)
  assert(members.length === 3, 'multi-slot members should preserve every approved application')
  assert(
    members.filter((m) => m.groupId === 'vendor-a').length === 2,
    'same vendor_id should share a group'
  )

  const grouped = groupMultiSlotTableVendorsForPlan(members, (ft) => ({
    colSpan: ft,
    rowSpan: 2,
  }))
  assert(grouped.length === 2, 'two vendors should produce two grouped layout units')
  const alpha = grouped.find((g) => g.id === 'app-a1')
  assert(alpha?.colSpan === 12, 'dual-slot vendor should span 12′ side-by-side on 1′ grid')
  assert(alpha?.rowSpan === 2, 'dual-slot vendor should keep 2′ equipment depth')

  const placed = {
    id: 'placed-1',
    row: 4,
    col: 10,
    rowSpan: 2,
    colSpan: 6,
  }
  const active = {
    id: 'active-1',
    row: 4,
    col: 16,
    rowSpan: 2,
    colSpan: 12,
  }
  assert(
    !bufferRingsOverlap(active, placed, 40, 40, true),
    'multi-unit snap should allow flush shared edge without buffer overlap'
  )

  const overlay = computeDualRingOverlay({
    active,
    placed: [placed],
    rows: 40,
    cols: 40,
    allowMultiUnitSnap: true,
  })
  assert(overlay.targetRings.length > 0, 'nearby booth should show target clearance rings')
  assert(overlay.valid, 'flush multi-unit placement beside single table should validate')

  console.log('✓ multi-slot + clearance overlay QA passed')
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('qa-scenarios')) {
  runLayoutQaScenarios()
  runMultiSlotAndClearanceQa()
}
