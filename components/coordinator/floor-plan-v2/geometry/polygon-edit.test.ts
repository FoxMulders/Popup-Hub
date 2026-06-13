/**
 * Unit checks for polygon-edit — run: npx tsx components/coordinator/floor-plan-v2/geometry/polygon-edit.test.ts
 */
import assert from 'node:assert/strict'
import {
  closeRing,
  editableRingForFrame,
  insertVertexOnEdge,
  isAxisAlignedRect,
  isSimplePolygon,
  moveVertex,
  nearestEdgeHit,
  projectPointOntoSegment,
  ringFromRect,
  syncFrameBoundsFromRing,
  translateRing,
} from './polygon-edit'
import { frameToRing } from '../state/placement-surface'
import type { RoomFrame } from '../state/types'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

const rectFrame: RoomFrame = {
  id: 'r1',
  name: 'Main Hall',
  originX: 0,
  originY: 0,
  widthFt: 50,
  lengthFt: 50,
}

console.log('polygon-edit tests')

test('ringFromRect matches frameToRing', () => {
  const a = ringFromRect(rectFrame)
  const b = [...frameToRing(rectFrame)]
  assert.deepEqual(a, b)
})

test('projectPointOntoSegment midpoint', () => {
  const r = projectPointOntoSegment({ x: 25, y: 5 }, 0, 0, 50, 0)
  assert.ok(Math.abs(r.point.x - 25) < 0.01)
  assert.ok(Math.abs(r.point.y) < 0.01)
  assert.ok(r.distance < 6)
})

test('insertVertexOnEdge adds fifth vertex', () => {
  const ring = ringFromRect(rectFrame)
  const hit = nearestEdgeHit({ x: 25, y: 2 }, ring, 5)
  assert.ok(hit)
  const next = insertVertexOnEdge(ring, hit!.edgeIndex, hit!.projection)
  assert.equal(next.length, 6) // 5 open + close
  assert.ok(isSimplePolygon(next.slice(0, -1).map(([x, y]) => ({ x, y }))))
})

test('hourglass rejected by isSimplePolygon', () => {
  const bowtie = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
    { x: 50, y: 0 },
    { x: 0, y: 50 },
  ]
  assert.equal(isSimplePolygon(bowtie), false)
})

test('translateRing + syncFrameBoundsFromRing', () => {
  const ring = ringFromRect(rectFrame)
  const moved = translateRing(ring, 10, 5)
  const synced = syncFrameBoundsFromRing(rectFrame, moved)
  assert.equal(synced.originX, 10)
  assert.equal(synced.originY, 5)
  assert.equal(synced.widthFt, 50)
  assert.equal(synced.lengthFt, 50)
})

test('isAxisAlignedRect toggles for skewed quad', () => {
  const ring = ringFromRect(rectFrame)
  assert.equal(isAxisAlignedRect(ring), true)
  const skewed = moveVertex(ring, 1, { x: 55, y: 3 })
  assert.equal(isAxisAlignedRect(skewed), false)
})

test('editableRingForFrame falls back to rect', () => {
  const ring = editableRingForFrame({ ...rectFrame, perimeterRing: undefined })
  assert.equal(ring.length, 5)
})

test('closeRing appends closing point', () => {
  const closed = closeRing([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ])
  assert.equal(closed.length, 5)
  assert.deepEqual(closed[0], closed[4])
})

console.log('All polygon-edit tests passed.')
