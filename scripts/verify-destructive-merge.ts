/**
 * Destructive merge (room + stage) — npx tsx scripts/verify-destructive-merge.ts
 */

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
}

const { doc, mergedId } = destructiveMergeInDoc(base, {
  roomIds: ['hall'],
  objectIds: ['stage-1'],
})

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

expect('merged id', mergedId != null)
expect('stage removed', !doc.objects.some((o) => o.id === 'stage-1'))
expect('merged_zone added', doc.objects.some((o) => o.kind === 'merged_zone'))
const hall = doc.rooms?.find((r) => r.id === 'hall')
expect('hall hidden', hall?.mergedIntoObjectId === mergedId)
const mz = doc.objects.find((o) => o.kind === 'merged_zone')
expect('union rings', (mz && 'rings' in mz && mz.rings.length > 0) ?? false)

if (process.exitCode) process.exit(1)
console.log('All destructive-merge checks passed.')
