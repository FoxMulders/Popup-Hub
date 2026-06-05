/**
 * QA merge verification — npx tsx scripts/verify-merge-qa.ts
 */

import { destructiveMergeInDocQa } from '../src/qa_review/components/coordinator/floor-plan-v2/state/Merge_qa'
import { vertexCountForRoom } from '../components/coordinator/floor-plan-v2/state/geometry-sanitize'
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

console.log('Stage bump into hall (2D bounds, not horizontal line)')
{
  const base: FloorPlanDoc = {
    canvasWidthFt: 200,
    canvasLengthFt: 200,
    gridSpacingFt: 1,
    snapFt: 1,
    objects: [
      {
        id: 'stage-1',
        kind: 'stage',
        x: 15,
        y: 65,
        width: 20,
        height: 20,
        rotation: 0,
        label: 'Stage',
      },
    ],
    rooms: [frame('hall', 0, 0, 50, 80)],
  }

  const { doc, mergedId } = destructiveMergeInDocQa(base, {
    roomIds: ['hall'],
    objectIds: ['stage-1'],
  })

  const hall = doc.rooms?.find((r) => r.id === 'hall')
  expect('merged id set', mergedId != null)
  expect('stage removed from objects', !doc.objects.some((o) => o.id === 'stage-1'))
  expect('union extends south for stage height', (hall?.lengthFt ?? 0) >= 85)
  expect('union width covers stage', (hall?.widthFt ?? 0) >= 35)
  expect('simple perimeter', vertexCountForRoom(hall!) <= 4)
}

console.log('Two-room merge unchanged')
{
  const base: FloorPlanDoc = {
    canvasWidthFt: 200,
    canvasLengthFt: 200,
    gridSpacingFt: 1,
    snapFt: 1,
    objects: [],
    rooms: [frame('a', 0, 0, 50, 50), frame('b', 50, 0, 30, 50)],
  }
  const { doc, mergedId } = destructiveMergeInDocQa(base, { roomIds: ['a', 'b'] })
  expect('merged id is a', mergedId === 'a')
  expect('union width 80', (doc.rooms?.[0]?.widthFt ?? 0) === 80)
}

if (process.exitCode) process.exit(1)
console.log('All merge QA checks passed.')
