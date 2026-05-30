/**
 * Merge overlap exemption — npx tsx scripts/verify-merge-overlap-exempt.ts
 */

import {
  placedObjectsOverlap,
  detectPlacedObjectOverlaps,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type {
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '../components/coordinator/floor-plan-v2/state/types'

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): RoomFrame {
  return { id, name: id, originX: x, originY: y, widthFt: w, lengthFt: h }
}

function stage(id: string, x: number, y: number, w: number, h: number): PlacedObject {
  return {
    id,
    kind: 'stage',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    label: 'Stage',
  }
}

function booth(id: string, x: number, y: number, w: number, h: number): PlacedObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    label: 'Booth',
  }
}

const rooms: RoomFrame[] = [frame('hall', 0, 0, 100, 80)]
const ctx = { rooms }

const stageInsideHall = stage('stage-1', 40, 30, 20, 30)
const boothA = booth('booth-a', 10, 10, 8, 8)
const boothB = booth('booth-b', 12, 12, 8, 8)

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

expect(
  'stage inside hall: placedObjectsOverlap false',
  !placedObjectsOverlap(stageInsideHall, boothA, ctx) &&
    !placedObjectsOverlap(stageInsideHall, stage('other', 0, 0, 1, 1), ctx)
)

const overlapSet = detectPlacedObjectOverlaps(
  [stageInsideHall, boothA, boothB],
  ctx
)
expect(
  'stage+hall exempt: stage not in overlap set',
  !overlapSet.has('stage-1')
)
expect(
  'booth pair still overlaps',
  overlapSet.has('booth-a') && overlapSet.has('booth-b')
)

expect(
  'booth overlap without merge ctx still true',
  placedObjectsOverlap(boothA, boothB)
)

if (process.exitCode) process.exit(1)
console.log('All merge-overlap-exempt checks passed.')
