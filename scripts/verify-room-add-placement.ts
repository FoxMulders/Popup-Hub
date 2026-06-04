/**
 * Add-room placement — npx tsx scripts/verify-room-add-placement.ts
 */

import { frameListFromRooms } from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
import { hydrateFloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/layout-hydration'
import {
  findRoomIdForPlacementPoint,
  isPointInRoomForObject,
  resolvePlacementRoomId,
} from '../components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import { createLayoutRoom } from '../lib/booth-planner/layout-rooms'
import type { FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

const layoutRoom = createLayoutRoom('Main Hall', {
  venue_width: 50,
  venue_length: 50,
  canvas_origin_x: 0,
  canvas_origin_y: 0,
})

console.log('Hydrate seeds room frames when wizard has rooms but no cells')
{
  const doc = hydrateFloorPlanDoc('evt-test', [layoutRoom])
  expect('doc has one room frame', (doc.rooms?.length ?? 0) === 1)
  const center = { x: 25, y: 25 }
  expect('center hits room', findRoomIdForPlacementPoint(doc, center) === layoutRoom.id)
  expect(
    'preferred room fallback',
    resolvePlacementRoomId(doc, center, layoutRoom.id) === layoutRoom.id
  )
}

console.log('Inverted perimeterRing still accepts interior booth center')
{
  const frames = frameListFromRooms([layoutRoom])
  const inverted = frames[0]!
  const badRing = [...(inverted.perimeterRing ?? [])].reverse()
  const doc: FloorPlanDoc = {
    canvasWidthFt: 50,
    canvasLengthFt: 50,
    gridSpacingFt: 1,
    snapFt: 1,
    objects: [],
    rooms: [{ ...inverted, perimeterRing: badRing }],
  }
  const booth = { x: 20, y: 20, width: 6, height: 6, rotation: 0 }
  expect(
    'booth center inside room',
    isPointInRoomForObject(doc, booth, layoutRoom.id)
  )
}

if (process.exitCode) {
  console.error('\nRoom add placement verification failed.')
  process.exit(1)
}
console.log('\nAll room add placement checks passed.')
