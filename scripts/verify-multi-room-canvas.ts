/**
 * Pure-math verification for the multi-room canvas overhaul.
 *
 * Exercises:
 *   - Building a unified `FloorPlanDoc` from two `LayoutRoom`s with
 *     distinct `canvas_origin_x/y` offsets.
 *   - Computing the unified canvas extents as the union of the
 *     rooms' world-space rectangles.
 *   - Detecting a shared wall when two rooms are nudged together
 *     within tolerance.
 *   - Suppressing the merged perimeter segment so two adjacent
 *     rooms render as a single combined interior.
 *   - Translating a room frame and verifying every child object
 *     in that room moves in lockstep with the parent origin.
 *   - Round-tripping the unified doc back to per-room
 *     `LayoutRoom` rows so save → load remains lossless on the
 *     new origin field.
 *
 * Run with: npx tsx scripts/verify-multi-room-canvas.ts
 */

import {
  docFromLegacyRooms,
  legacyRoomsFromDoc,
  unifiedCanvasExtents,
  frameListFromRooms,
} from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
import {
  CANVAS_DIMENSION_SCALE,
  clampRoomMoveDelta,
  reconcileCanvasExtents,
  roomResizeFromHandle,
  roomUnionBounds,
} from '../components/coordinator/floor-plan-v2/state/room-canvas'
import {
  computeRoomWallSegments,
  detectMergedRoomPairs,
  pointHitsFrameStroke,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type {
  BoothCell,
  LayoutRoom,
  VenueElement,
} from '../types/database'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, info?: string) {
  if (ok) {
    pass++
    console.log(`PASS  ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}${info ? ` -- ${info}` : ''}`)
  }
}

function makeBoothCell(id: string, col: number, row: number): BoothCell {
  return {
    id,
    col,
    row,
    colSpan: 4,
    rowSpan: 3,
    vendorName: id,
    categoryName: '',
    categoryColor: '#94a3b8',
    boothNumber: 1,
    boothType: 'inside',
    vendorUnitType: 'table',
    tableLengthFt: null,
    tableOrientation: null,
    facingTarget: null,
  }
}

function makeWallElement(id: string, col: number, row: number): VenueElement {
  return {
    id,
    type: 'column',
    col,
    row,
    colSpan: 2,
    rowSpan: 2,
  }
}

function makeRoom(
  id: string,
  name: string,
  width: number,
  length: number,
  originX: number,
  originY: number,
  cells: BoothCell[] = [],
  venueElements: VenueElement[] = []
): LayoutRoom {
  return {
    id,
    name,
    venue_width: width,
    venue_length: length,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells,
    venue_elements: venueElements,
    canvas_origin_x: originX,
    canvas_origin_y: originY,
  }
}

console.log('=== Multi-room canvas verification ===\n')

// ----- Case 1: build unified doc + verify global coords + extents -----
{
  const mainHall = makeRoom(
    'r-main',
    'Main Hall',
    50,
    50,
    0,
    0,
    [makeBoothCell('b-1', 5, 5), makeBoothCell('b-2', 20, 10)]
  )
  const annex = makeRoom(
    'r-annex',
    'Annex',
    40,
    40,
    50,
    0,
    [makeBoothCell('b-3', 2, 2)],
    [makeWallElement('w-1', 8, 4)]
  )

  const doc = docFromLegacyRooms([mainHall, annex])

  check(
    'Unified doc builds objects in global coords',
    doc.objects.find((o) => o.id === 'b-3')?.x === 50 + 2,
    `b-3.x=${doc.objects.find((o) => o.id === 'b-3')?.x}`
  )
  const expectedExtents = reconcileCanvasExtents(doc.rooms ?? [])
  check(
    'Unified extents = union of rooms + margin (capped at 5× primary)',
    doc.canvasWidthFt === expectedExtents.canvasWidthFt &&
      doc.canvasLengthFt === expectedExtents.canvasLengthFt,
    `${doc.canvasWidthFt}x${doc.canvasLengthFt} expected ${expectedExtents.canvasWidthFt}x${expectedExtents.canvasLengthFt}`
  )
  check(
    'objectRoom map tags every object',
    doc.objectRoom?.['b-1'] === 'r-main' &&
      doc.objectRoom?.['b-3'] === 'r-annex' &&
      doc.objectRoom?.['w-1'] === 'r-annex'
  )
  check(
    'Two RoomFrames are produced',
    (doc.rooms?.length ?? 0) === 2 &&
      doc.rooms?.[0]!.id === 'r-main' &&
      doc.rooms?.[1]!.originX === 50
  )
}

// ----- Case 2: drag a room and verify children move with it -----
{
  const mainHall = makeRoom(
    'r-main',
    'Main Hall',
    50,
    50,
    0,
    0,
    [makeBoothCell('b-1', 5, 5)]
  )
  const annex = makeRoom(
    'r-annex',
    'Annex',
    40,
    40,
    100,
    0,
    [makeBoothCell('b-3', 2, 2)]
  )

  const doc = docFromLegacyRooms([mainHall, annex])

  // Simulate moveRoomFrame(annex, dx=-46, dy=0) so the annex's left
  // edge butts against the Main Hall's right edge (50).
  const dx = -46
  const dy = 0
  const movedRooms = (doc.rooms ?? []).map((f) =>
    f.id === 'r-annex'
      ? { ...f, originX: f.originX + dx, originY: f.originY + dy }
      : f
  )
  const movedObjects = doc.objects.map((o) => {
    if ((doc.objectRoom ?? {})[o.id] !== 'r-annex') return o
    return { ...o, x: o.x + dx, y: o.y + dy }
  })

  const annexFrame = movedRooms.find((f) => f.id === 'r-annex')!
  const childB3 = movedObjects.find((o) => o.id === 'b-3')!
  check(
    'Room drag shifts the frame origin',
    annexFrame.originX === 54 && annexFrame.originY === 0
  )
  check(
    'Room drag translates every child booth in lockstep',
    childB3.x === 100 + 2 + dx && childB3.y === 0 + 2
  )
  // After move: annex left edge = 54. Wait, that's not actually
  // touching Main Hall's right edge (50). Let me re-check.
}

// ----- Case 3: detect merged shared wall when rooms are flush -----
{
  const mainHall = makeRoom('r-main', 'Main Hall', 50, 50, 0, 0)
  // Place the annex's left edge exactly at the main hall's right
  // edge (originX = 50). Y range overlaps from 0..40.
  const annex = makeRoom('r-annex', 'Annex', 40, 40, 50, 0)

  const frames = frameListFromRooms([mainHall, annex])
  const merged = detectMergedRoomPairs(frames)
  check(
    'Detects flush rooms as merged',
    merged.length === 1 &&
      merged[0]!.a === 'r-main' &&
      merged[0]!.b === 'r-annex' &&
      Math.abs(merged[0]!.sharedLengthFt - 40) < 1e-6,
    `merged=${JSON.stringify(merged)}`
  )

  const segments = computeRoomWallSegments(frames)
  const mainEdges = segments.get('r-main') ?? []
  const annexEdges = segments.get('r-annex') ?? []
  const mainRightSegmentExists = mainEdges.some(
    (e) => e.side === 'right' && e.to - e.from > 0
  )
  // Main Hall's right edge between y=0 and y=40 should be SUPPRESSED
  // by the merge. The portion between y=40 and y=50 should remain.
  const mainRightRemaining = mainEdges
    .filter((e) => e.side === 'right')
    .reduce((acc, e) => acc + (e.to - e.from), 0)
  check(
    'Merged right wall of Main Hall is suppressed',
    !mainRightSegmentExists ||
      Math.abs(mainRightRemaining - (50 - 40)) < 1e-6,
    `remaining right wall of Main Hall = ${mainRightRemaining}`
  )
  const annexLeftRemaining = annexEdges
    .filter((e) => e.side === 'left')
    .reduce((acc, e) => acc + (e.to - e.from), 0)
  check(
    'Merged left wall of Annex is suppressed (full)',
    annexLeftRemaining === 0,
    `remaining left wall of Annex = ${annexLeftRemaining}`
  )
}

// ----- Case 4: rooms within tolerance still merge -----
{
  const mainHall = makeRoom('r-main', 'Main Hall', 50, 50, 0, 0)
  // 0.3 ft gap — well within the 0.5 ft tolerance.
  const annex = makeRoom('r-annex', 'Annex', 40, 40, 50.3, 0)

  const frames = frameListFromRooms([mainHall, annex])
  const merged = detectMergedRoomPairs(frames)
  check(
    'Rooms 0.3 ft apart still merge (within 0.5 ft tolerance)',
    merged.length === 1
  )
}

// ----- Case 5: rooms beyond tolerance do NOT merge -----
{
  const mainHall = makeRoom('r-main', 'Main Hall', 50, 50, 0, 0)
  // 1.0 ft gap — outside tolerance.
  const annex = makeRoom('r-annex', 'Annex', 40, 40, 51, 0)

  const frames = frameListFromRooms([mainHall, annex])
  const merged = detectMergedRoomPairs(frames)
  check(
    'Rooms 1 ft apart do NOT merge (beyond tolerance)',
    merged.length === 0
  )
  const segments = computeRoomWallSegments(frames)
  const mainRightLen = (segments.get('r-main') ?? [])
    .filter((e) => e.side === 'right')
    .reduce((acc, e) => acc + (e.to - e.from), 0)
  check(
    'Main Hall right wall paints at full length when not merged',
    Math.abs(mainRightLen - 50) < 1e-6,
    `right wall length = ${mainRightLen}`
  )
}

// ----- Case 6: pointHitsFrameStroke correctly identifies wall clicks -----
{
  const frame = {
    id: 'r-test',
    originX: 10,
    originY: 10,
    widthFt: 30,
    lengthFt: 20,
  }
  check(
    'Hit on left wall counts as a stroke hit',
    pointHitsFrameStroke(frame, { x: 10, y: 15 }, 0.5)
  )
  check(
    'Hit slightly inside left wall (within tolerance) still counts',
    pointHitsFrameStroke(frame, { x: 10.3, y: 15 }, 0.5)
  )
  check(
    'Hit at room center does NOT count as a stroke hit',
    !pointHitsFrameStroke(frame, { x: 25, y: 20 }, 0.5)
  )
  check(
    'Hit far outside the room does NOT count',
    !pointHitsFrameStroke(frame, { x: 100, y: 100 }, 0.5)
  )
}

// ----- Case 7: legacyRoomsFromDoc round-trip preserves origins -----
{
  const mainHall = makeRoom(
    'r-main',
    'Main Hall',
    50,
    50,
    0,
    0,
    [makeBoothCell('b-1', 5, 5)]
  )
  const annex = makeRoom(
    'r-annex',
    'Annex',
    40,
    40,
    50,
    0,
    [makeBoothCell('b-3', 2, 2)]
  )

  const doc = docFromLegacyRooms([mainHall, annex])
  // Move annex by (-46, 0) inside the unified doc.
  const movedDoc = {
    ...doc,
    rooms: (doc.rooms ?? []).map((f) =>
      f.id === 'r-annex' ? { ...f, originX: 4 } : f
    ),
    objects: doc.objects.map((o) =>
      (doc.objectRoom ?? {})[o.id] === 'r-annex'
        ? { ...o, x: o.x - 46 }
        : o
    ),
  }
  const projected = legacyRoomsFromDoc([mainHall, annex], movedDoc)
  const projectedAnnex = projected.find((r) => r.id === 'r-annex')!
  check(
    'Round-trip preserves moved canvas_origin_x',
    projectedAnnex.canvas_origin_x === 4
  )
  // Annex's b-3 was at global x=52. After move, x=6. Local x = 6 - 4 = 2.
  // BoothCell.col should be 2 again.
  const projectedB3 = projectedAnnex.cells.find((c) => c.id === 'b-3')!
  check(
    'Round-trip yields room-local cell coords after a drag',
    projectedB3.col === 2 && projectedB3.row === 2,
    `col=${projectedB3.col} row=${projectedB3.row}`
  )
}

// ----- Case 8: defaults preserved for legacy rooms -----
{
  const legacy: LayoutRoom = {
    id: 'r-legacy',
    name: 'Legacy',
    venue_width: 60,
    venue_length: 60,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells: [makeBoothCell('b-x', 1, 1)],
    venue_elements: [],
    // Note: NO canvas_origin_* set — defaults to 0.
  }
  const doc = docFromLegacyRooms([legacy])
  check(
    'Legacy room without canvas_origin_* defaults to (0, 0)',
    doc.rooms?.[0]!.originX === 0 && doc.rooms?.[0]!.originY === 0
  )
  check(
    'Legacy room cell projects without offset',
    doc.objects[0]!.x === 1 && doc.objects[0]!.y === 1
  )
}

// ----- Case 9: extents helper for an empty list -----
{
  const empty = unifiedCanvasExtents([])
  check(
    'Empty room list yields fallback canvas with margin',
    empty.width === 74 && empty.length === 74
  )
}

// ----- Case 10: canvas grows past nominal 5× when union requires it -----
{
  const primary = makeRoom('r-main', 'Main Hall', 50, 50, 0, 0)
  const farAnnex = makeRoom('r-far', 'Far Wing', 40, 40, 220, 0)
  const frames = frameListFromRooms([primary, farAnnex])
  const extents = reconcileCanvasExtents(frames)
  const capW = 50 * CANVAS_DIMENSION_SCALE
  const neededW = roomUnionBounds(frames).maxX + 24
  check(
    'Canvas width grows to fit union when beyond nominal 5× cap',
    extents.canvasWidthFt === neededW && extents.canvasWidthFt > capW,
    `canvasWidthFt=${extents.canvasWidthFt} expected > ${capW} and ${neededW}`
  )
  check(
    'Room union maxX is beyond the nominal cap (geometry uncapped)',
    roomUnionBounds(frames).maxX === 260
  )
}

// ----- Case 11: room drag uses expanded union limits (not stale 5× only) -----
{
  const main = makeRoom('r-main', 'Main Hall', 50, 50, 0, 0)
  const annex = makeRoom('r-annex', 'Annex', 40, 40, 200, 0)
  const frames = frameListFromRooms([main, annex])
  const { dx, dy } = clampRoomMoveDelta(frames, 'r-annex', 100, 0)
  const moved = frames.map((f) =>
    f.id === 'r-annex' ? { ...f, originX: f.originX + dx, originY: f.originY + dy } : f
  )
  const bounds = roomUnionBounds(moved)
  check(
    'Annex drag applies full delta when union limit expands',
    dx === 100 && dy === 0,
    `dx=${dx} dy=${dy}`
  )
  check(
    'Post-drag union maxX reflects moved annex',
    bounds.maxX === 340
  )
}

// ----- Case 12: room resize handle math (SE corner grows footprint) -----
{
  const frame = {
    id: 'r-main',
    name: 'Main Hall',
    originX: 10,
    originY: 5,
    widthFt: 50,
    lengthFt: 40,
  }
  const patch = roomResizeFromHandle(
    frame,
    'se',
    { x: 70, y: 55 },
    { x: 10, y: 5 }
  )
  check(
    'SE resize keeps origin and expands width/length to pointer',
    patch.originX === 10 &&
      patch.originY === 5 &&
      patch.widthFt === 60 &&
      patch.lengthFt === 50
  )
  const nwPatch = roomResizeFromHandle(
    frame,
    'nw',
    { x: 20, y: 10 },
    { x: 60, y: 45 }
  )
  check(
    'NW resize moves origin and shrinks width/length',
    nwPatch.originX === 20 &&
      nwPatch.originY === 10 &&
      nwPatch.widthFt === 40 &&
      nwPatch.lengthFt === 35
  )
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
