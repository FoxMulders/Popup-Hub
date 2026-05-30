/**
 * Placement surface + rotation pivot — npx tsx scripts/verify-placement-surface.ts
 */

import {
  pointInsidePlacementSurface,
  resolveRoomPlacementSurface,
  roomRotationPivot,
} from '../components/coordinator/floor-plan-v2/state/placement-surface'
import { destructiveMergeInDoc } from '../components/coordinator/floor-plan-v2/state/destructive-merge'
import type { FloorPlanDoc, RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): RoomFrame {
  return { id, name: id, originX: x, originY: y, widthFt: w, lengthFt: h }
}

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

const base: FloorPlanDoc = {
  canvasWidthFt: 200,
  canvasLengthFt: 200,
  gridSpacingFt: 1,
  snapFt: 1,
  objects: [
    {
      id: 'stage-1',
      kind: 'stage',
      x: 70,
      y: 40,
      width: 20,
      height: 30,
      rotation: 0,
      label: 'Stage',
    },
  ],
  rooms: [frame('hall', 0, 0, 100, 80)],
  objectRoom: { 'stage-1': 'hall' },
}

const { doc: merged } = destructiveMergeInDoc(base, {
  roomIds: ['hall'],
  objectIds: ['stage-1'],
})

const surface = resolveRoomPlacementSurface(merged, 'hall')
expect('merged surface exists', surface != null)
expect(
  'point inside L-union (center of hall)',
  surface != null && pointInsidePlacementSurface({ x: 50, y: 40 }, surface)
)
expect(
  'point outside union',
  surface != null && !pointInsidePlacementSurface({ x: 150, y: 150 }, surface)
)

const pivot = roomRotationPivot(merged, 'hall')
expect('pivot not at 0,0', pivot.x > 10 && pivot.y > 10)

if (process.exitCode) process.exit(1)
console.log('All placement-surface checks passed.')
