/**
 * Food truck canvas-open placement:
 *   - Valid on open canvas outside any room (within canvas bounds)
 *   - Valid inside a room when centroid is interior
 *   - Rejected when footprint extends past canvas edge
 *   - Legacy round-trip via custom_label + FOODTRUCK@ sentinel
 *
 * Run: npx tsx scripts/verify-food-truck-placement.ts
 */

import {
  isValidObjectPlacement,
  resolvePlacementRoomIdForObject,
} from '../components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import { canvasOpenPlacementOverlapsWall } from '../lib/floor-plan/canvas-open-placement'
import {
  docFromLegacyRoom,
  legacyRoomFromDoc,
} from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
import { makeEmptyDoc } from '../components/coordinator/floor-plan-v2/state/types'
import type {
  FloorPlanDoc,
  FoodTruckObject,
  PlacedObject,
  RoomFrame,
} from '../components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '../types/database'

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

function truck(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): PlacedObject {
  return {
    id,
    kind: 'food_truck',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    label: 'Taco truck',
  } as PlacedObject
}

const baseRoom: LayoutRoom = {
  id: 'room-1',
  name: 'Hall A',
  venue_width: 120,
  venue_length: 120,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells: [],
  venue_elements: [],
}

console.log('Food truck — parking lot outside Main Hall')
{
  const mainHall = frame('hall', 'Main Hall', 10, 10, 50, 80)
  const doc: FloorPlanDoc = {
    ...makeEmptyDoc(120, 120),
    rooms: [mainHall],
    objects: [],
  }
  const lotTruck = truck('ft1', 70, 40, 8, 20)
  const roomId = resolvePlacementRoomIdForObject(doc, lotTruck, null)
  expect('outside lot truck has no room owner', roomId, null)
  expect(
    'outside lot truck placement valid',
    isValidObjectPlacement(doc, lotTruck, roomId),
    true
  )

  const insideTruck = truck('ft2', 25, 30, 8, 20)
  const insideRoomId = resolvePlacementRoomIdForObject(doc, insideTruck, null)
  expect('inside truck resolves to hall', insideRoomId, 'hall')
  expect(
    'inside truck placement valid',
    isValidObjectPlacement(doc, insideTruck, insideRoomId),
    true
  )

  const offCanvas = truck('ft3', 115, 40, 8, 20)
  expect(
    'off-canvas truck rejected',
    isValidObjectPlacement(doc, offCanvas, null),
    false
  )
}

console.log('Food truck — wall overlap rejected')
{
  const doc: FloorPlanDoc = makeEmptyDoc(80, 80)
  doc.objects.push({
    id: 'wall-1',
    kind: 'wall',
    x: 20,
    y: 10,
    width: 2,
    height: 30,
    rotation: 0,
  } as PlacedObject)
  const overlapping = truck('ft-wall', 18, 15, 8, 20)
  const clear = truck('ft-clear', 40, 15, 8, 20)
  expect(
    'overlapping truck blocked',
    isValidObjectPlacement(doc, overlapping, null),
    false
  )
  expect(
    'clear truck allowed',
    isValidObjectPlacement(doc, clear, null),
    true
  )
  expect(
    'overlap predicate matches',
    canvasOpenPlacementOverlapsWall(doc, overlapping),
    true
  )
}

console.log('Food truck — legacy round-trip')
{
  const doc: FloorPlanDoc = makeEmptyDoc(80, 80)
  const ft: FoodTruckObject = {
    id: 'ft-legacy',
    kind: 'food_truck',
    x: 5,
    y: 10,
    width: 8,
    height: 20,
    rotation: 0,
    label: 'BBQ wagon',
  }
  doc.objects.push(ft)
  const legacy = legacyRoomFromDoc(baseRoom, doc)
  const el = legacy.venue_elements?.find((e) => e.id === 'ft-legacy')
  expect('projects to custom_label', el?.type, 'custom_label')
  expect('label carries FOODTRUCK@ sentinel', el?.label, 'FOODTRUCK@BBQ wagon')

  const restored = docFromLegacyRoom(legacy)
  const obj = restored.objects.find((o) => o.id === 'ft-legacy')
  expect('restored kind', obj?.kind, 'food_truck')
  expect('restored label', (obj as FoodTruckObject | undefined)?.label, 'BBQ wagon')
}

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
