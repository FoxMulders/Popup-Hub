/**
 * Unit checks for vendor-fairness-layout geometry — run:
 *   npx tsx lib/vendor-fairness-layout/geometry/geometry.test.ts
 */
import assert from 'node:assert/strict'
import {
  anyBoothOverlap,
  boothsOverlap,
  buildSerpentineAisle,
  pointInRoom,
  validateBoothInRoom,
  validateRoomBoundary,
} from './index'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('vendor-fairness-layout geometry tests')

const rectRoom = {
  boundary: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ],
}

const lShapeRoom = {
  boundary: [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 40 },
    { x: 100, y: 40 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ],
}

const irregularRoom = {
  boundary: [
    { x: 10, y: 5 },
    { x: 90, y: 8 },
    { x: 95, y: 50 },
    { x: 70, y: 75 },
    { x: 20, y: 70 },
    { x: 5, y: 35 },
  ],
}

test('rectangle room validates', () => {
  assert.equal(validateRoomBoundary(rectRoom.boundary).ok, true)
})

test('point inside rectangle', () => {
  assert.equal(pointInRoom({ x: 50, y: 40 }, rectRoom.boundary), true)
  assert.equal(pointInRoom({ x: 150, y: 40 }, rectRoom.boundary), false)
})

test('L-shaped room containment', () => {
  assert.equal(pointInRoom({ x: 30, y: 20 }, lShapeRoom.boundary), true)
  assert.equal(pointInRoom({ x: 80, y: 20 }, lShapeRoom.boundary), false)
})

test('irregular polygon containment', () => {
  assert.equal(pointInRoom({ x: 50, y: 40 }, irregularRoom.boundary), true)
})

test('booth overlap detection', () => {
  const a = { id: 'a', x: 10, y: 10, width: 10, height: 8, rotation: 0 }
  const b = { id: 'b', x: 15, y: 12, width: 10, height: 8, rotation: 0 }
  const c = { id: 'c', x: 30, y: 10, width: 10, height: 8, rotation: 0 }
  assert.equal(boothsOverlap(a, b), true)
  assert.equal(boothsOverlap(a, c), false)
  assert.equal(anyBoothOverlap([a, c]), false)
})

test('serpentine aisle in rectangle', () => {
  const aisle = buildSerpentineAisle(
    rectRoom,
    { x: 10, y: 70 },
    { x: 90, y: 5 },
    10
  )
  assert.ok(aisle.centerline.length >= 3)
  for (const p of aisle.centerline) {
    assert.equal(pointInRoom(p, rectRoom.boundary), true)
  }
})

test('booth placement validation', () => {
  assert.equal(
    validateBoothInRoom({ x: 20, y: 20, width: 10, height: 8, rotation: 0 }, rectRoom.boundary),
    true
  )
  assert.equal(
    validateBoothInRoom({ x: 95, y: 20, width: 10, height: 8, rotation: 0 }, rectRoom.boundary),
    false
  )
})

console.log('All geometry tests passed.')
