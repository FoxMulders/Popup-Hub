/**
 * Smoke-test the asset-type-restricted polygon-join feature:
 *
 *   1. `isJoinableObject` correctly classifies kinds (stage = yes,
 *      booth/wall/door/etc. = no).
 *   2. `isAuxiliaryRoom` recognises auxiliary names (Kitchen, Storage,
 *      Washroom, Annex, Outdoor Stage, Corridor) and rejects the
 *      generic Main Hall.
 *   3. `mixedNeighborsOf` returns rooms + joinable objects but never
 *      booths or walls.
 *   4. `buildJoinedZone` correctly unions a room AABB with a Stage
 *      object's AABB into a single dissolved outer perimeter.
 *
 * Run with: npx tsx scripts/verify-asset-type-joins.ts
 */

import {
  buildJoinedZone,
  isAuxiliaryRoom,
  isJoinableObject,
  mixedNeighborsOf,
  objectFrameOverlapsOrTouches,
} from '../components/coordinator/floor-plan-v2/state/room-joins'
import type {
  PlacedObject,
  RoomFrame,
} from '../components/coordinator/floor-plan-v2/state/types'

let failed = 0
function expect(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof actual === 'object'
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

function frame(
  id: string,
  name: string,
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): RoomFrame {
  return { id, name, originX, originY, widthFt, lengthFt }
}

function obj(
  id: string,
  kind: PlacedObject['kind'],
  x: number,
  y: number,
  w: number,
  h: number
): PlacedObject {
  return {
    id,
    kind,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
  } as PlacedObject
}

console.log('isJoinableObject — only stage qualifies')
{
  expect('stage joinable', isJoinableObject(obj('a', 'stage', 0, 0, 10, 10)), true)
  expect('booth NOT joinable', isJoinableObject(obj('b', 'booth', 0, 0, 10, 10)), false)
  expect('wall NOT joinable', isJoinableObject(obj('c', 'wall', 0, 0, 10, 10)), false)
  expect('door NOT joinable', isJoinableObject(obj('d', 'door', 0, 0, 10, 10)), false)
  expect('label NOT joinable', isJoinableObject(obj('f', 'label', 0, 0, 10, 10)), false)
  expect('emergency_exit NOT joinable', isJoinableObject(obj('g', 'emergency_exit', 0, 0, 10, 10)), false)
  expect('open_wall NOT joinable', isJoinableObject(obj('h', 'open_wall', 0, 0, 10, 10)), false)
}

console.log('isAuxiliaryRoom — auxiliary names match, Main Hall does not')
{
  expect('Kitchen Area', isAuxiliaryRoom(frame('a', 'Kitchen Area', 0, 0, 30, 24)), true)
  expect('Storage room', isAuxiliaryRoom(frame('b', 'Storage room', 0, 0, 10, 10)), true)
  expect('Washroom', isAuxiliaryRoom(frame('c', 'Washroom A', 0, 0, 10, 10)), true)
  expect('Restroom variant', isAuxiliaryRoom(frame('c2', 'Public restroom', 0, 0, 10, 10)), true)
  expect('Corridor', isAuxiliaryRoom(frame('d', 'Corridor 1', 0, 0, 10, 10)), true)
  expect('Hallway', isAuxiliaryRoom(frame('e', 'East Hallway', 0, 0, 10, 10)), true)
  expect('Annex Room', isAuxiliaryRoom(frame('f', 'Annex Room', 0, 0, 40, 40)), true)
  expect('Outdoor Stage', isAuxiliaryRoom(frame('g', 'Outdoor Stage', 0, 0, 60, 30)), true)
  expect('Main Hall NOT auxiliary', isAuxiliaryRoom(frame('h', 'Main Hall', 0, 0, 50, 80)), false)
  expect('Generic Room NOT auxiliary', isAuxiliaryRoom(frame('i', 'Room 2', 0, 0, 50, 50)), false)
}

console.log('objectFrameOverlapsOrTouches — stage flush against the room edge')
{
  // Main Hall: 50 wide, 80 long, at origin (0,0).
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  // Stage parked just outside the right wall, touching at x=50.
  const stage = obj('stage1', 'stage', 50, 20, 12, 16)
  expect('touching stage detected', objectFrameOverlapsOrTouches(stage, mainHall), true)

  // Stage 1 ft away — outside the touch tolerance.
  const farStage = obj('stage2', 'stage', 51.5, 20, 12, 16)
  expect('detached stage NOT detected', objectFrameOverlapsOrTouches(farStage, mainHall), false)

  // Stage overlapping by 5 ft.
  const overlappingStage = obj('stage3', 'stage', 45, 20, 12, 16)
  expect('overlapping stage detected', objectFrameOverlapsOrTouches(overlappingStage, mainHall), true)
}

console.log('mixedNeighborsOf — gates booths/walls out, surfaces auxiliary rooms + stages')
{
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  const kitchen = frame('kit', 'Kitchen Area', 50, 0, 30, 24)
  const farRoom = frame('far', 'Annex Room', 200, 200, 40, 40)
  const stage = obj('stage1', 'stage', 50, 30, 12, 16)
  const booth = obj('booth1', 'booth', 50, 50, 6, 10) // touches but NOT joinable
  const wall = obj('wall1', 'wall', 50, 60, 4, 1)

  const neighbors = mixedNeighborsOf(
    { kind: 'room', id: 'hall' },
    [mainHall, kitchen, farRoom],
    [stage, booth, wall]
  )
  // Sort by id so the assertion is stable.
  const ids = neighbors.map((n) => `${n.kind}:${n.id}`).sort()
  expect(
    'main hall neighbours = kitchen + stage1 (booth + wall + far room excluded)',
    ids,
    ['object:stage1', 'room:kit']
  )
}

console.log('mixedNeighborsOf with stage initiator — room neighbours surface')
{
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  const stage = obj('stage1', 'stage', 50, 30, 12, 16)
  const detachedRoom = frame('det', 'Detached', 200, 200, 30, 30)
  const neighbors = mixedNeighborsOf(
    { kind: 'object', id: 'stage1' },
    [mainHall, detachedRoom],
    [stage]
  )
  const ids = neighbors.map((n) => `${n.kind}:${n.id}`).sort()
  expect('stage neighbour = main hall only', ids, ['room:hall'])
}

console.log('mixedNeighborsOf with booth initiator — empty (booth not joinable)')
{
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  const booth = obj('booth1', 'booth', 50, 30, 6, 10)
  const neighbors = mixedNeighborsOf(
    { kind: 'object', id: 'booth1' },
    [mainHall],
    [booth]
  )
  expect('booth as initiator returns empty', neighbors.length, 0)
}

console.log('buildJoinedZone — room + stage union dissolves shared edge')
{
  // Room: 0..50 × 0..80
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  // Stage flush against the right wall: 50..62 × 30..46
  const stage = obj('stage1', 'stage', 50, 30, 12, 16)
  const zone = buildJoinedZone('grp', [mainHall], [stage])
  if (!zone) {
    expect('zone built', null, 'JoinedZone')
  } else {
    expect('frameIds mirrors input', zone.frameIds, ['hall'])
    expect('objectIds mirrors input', zone.objectIds, ['stage1'])
    expect('zone aabb encloses both', zone.aabb, {
      minX: 0,
      minY: 0,
      maxX: 62,
      maxY: 80,
    })
    // Area = 50*80 + 12*16 = 4000 + 192 = 4192 sq ft (exact, no overlap).
    expect('zone area = 4192 sq ft', zone.areaSqFt, 4192)
    // L-shape: outer ring should have 8 distinct vertices (closed → 9 entries).
    const ring = zone.rings[0]
    expect('zone has exactly 1 outer ring (L-shape)', zone.rings.length, 1)
    expect('L-shape has 8 vertices + closed', ring?.length, 9)
  }
}

console.log('buildJoinedZone — room + booth (booth filtered out)')
{
  const mainHall = frame('hall', 'Main Hall', 0, 0, 50, 80)
  const booth = obj('booth1', 'booth', 50, 30, 6, 10)
  const zone = buildJoinedZone('grp', [mainHall], [booth])
  if (!zone) {
    expect('zone built', null, 'JoinedZone')
  } else {
    expect('booth NOT in objectIds', zone.objectIds, [])
    expect('zone is just the hall (booth filtered)', zone.aabb, {
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 80,
    })
  }
}

console.log('buildJoinedZone — two overlapping stages with no room')
{
  const stageA = obj('a', 'stage', 0, 0, 20, 10)
  const stageB = obj('b', 'stage', 18, 0, 20, 10) // overlap [18,20]
  const zone = buildJoinedZone('grp', [], [stageA, stageB])
  if (!zone) {
    expect('zone built (objects only)', null, 'JoinedZone')
  } else {
    expect('frameIds empty', zone.frameIds, [])
    expect('objectIds = [a, b]', zone.objectIds, ['a', 'b'])
    expect('zone aabb spans both', zone.aabb, {
      minX: 0,
      minY: 0,
      maxX: 38,
      maxY: 10,
    })
    // Area = 20*10 + 20*10 - 2*10 = 380 sq ft (overlap subtracted).
    expect('zone area = 380 sq ft', zone.areaSqFt, 380)
  }
}

if (failed > 0) {
  console.log(`\n${failed} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log('\nAll assertions passed.')
}
