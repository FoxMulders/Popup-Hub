/**
 * Unit checks for door egress clearance zones — run:
 *   npx tsx lib/floor-plan/door-clearance-zones.test.ts
 */
import assert from 'node:assert/strict'
import {
  DOOR_EGRESS_CLEARANCE_FT,
  boothWithinDoorClearanceZone,
  doorClearanceObstacleRects,
  doorClearanceZoneRect,
  isDoorOrExitObject,
} from './door-clearance-zones'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

function door(id: string, x: number, y: number): PlacedObject {
  return {
    id,
    kind: 'door',
    x,
    y,
    width: 3,
    height: 1,
    rotation: 0,
    doorType: 'entrance',
  }
}

function boothRect(x: number, y: number, width = 6, height = 2) {
  return { x, y, width, height }
}

console.log('door-clearance-zones tests')

test('DOOR_EGRESS_CLEARANCE_FT is 5′', () => {
  assert.equal(DOOR_EGRESS_CLEARANCE_FT, 5)
})

test('isDoorOrExitObject recognizes door and emergency_exit', () => {
  assert.equal(isDoorOrExitObject(door('d1', 0, 0)), true)
  assert.equal(
    isDoorOrExitObject({ ...door('e1', 0, 0), kind: 'emergency_exit' }),
    true
  )
  assert.equal(
    isDoorOrExitObject({ ...door('w1', 0, 0), kind: 'wall' }),
    false
  )
})

test('doorClearanceZoneRect expands footprint by egress clearance', () => {
  const zone = doorClearanceZoneRect(door('d1', 10, 0))
  assert.equal(zone.x, 10 - DOOR_EGRESS_CLEARANCE_FT)
  assert.equal(zone.y, 0 - DOOR_EGRESS_CLEARANCE_FT)
  assert.equal(zone.width, 3 + DOOR_EGRESS_CLEARANCE_FT * 2)
  assert.equal(zone.height, 1 + DOOR_EGRESS_CLEARANCE_FT * 2)
})

test('booth directly in front of door is within egress zone', () => {
  const d = door('d1', 10, 0)
  const nearby = boothRect(10, 6, 6, 2)
  assert.equal(boothWithinDoorClearanceZone(nearby, d), true)
})

test('booth far along same wall row is outside egress zone', () => {
  const d = door('d1', 10, 0)
  const farAlongRow = boothRect(40, 6, 6, 2)
  assert.equal(boothWithinDoorClearanceZone(farAlongRow, d), false)
})

test('booth beyond 5′ edge clearance is outside egress zone', () => {
  const d = door('d1', 0, 0)
  const beyond = boothRect(0, 12, 6, 2)
  assert.equal(boothWithinDoorClearanceZone(beyond, d), false)
})

test('doorClearanceObstacleRects only includes door kinds', () => {
  const objects: PlacedObject[] = [
    door('d1', 5, 0),
    { ...door('w1', 0, 0), kind: 'wall' },
    { ...door('e1', 20, 0), kind: 'emergency_exit' },
  ]
  const rects = doorClearanceObstacleRects(objects)
  assert.equal(rects.length, 2)
})

console.log('door-clearance-zones tests passed')
