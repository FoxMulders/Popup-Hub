/**
 * Two-room destructive merge + legacy projection — npx tsx scripts/verify-room-merge-two-rooms.ts
 */

import { destructiveMergeInDoc } from '../components/coordinator/floor-plan-v2/state/destructive-merge'
import { legacyRoomsFromDoc } from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
import type { FloorPlanDoc, RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '@/types/database'

function frame(id: string, x: number, y: number, w: number, h: number): RoomFrame {
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
      id: 'b1',
      kind: 'booth',
      x: 5,
      y: 5,
      width: 8,
      height: 8,
      rotation: 0,
      tablePurpose: 'vendor',
    },
    {
      id: 'b2',
      kind: 'booth',
      x: 55,
      y: 10,
      width: 8,
      height: 8,
      rotation: 0,
      tablePurpose: 'vendor',
    },
  ],
  rooms: [frame('a', 0, 0, 50, 50), frame('b', 50, 0, 30, 50)],
  objectRoom: { b1: 'a', b2: 'b' },
}

const layoutRooms: LayoutRoom[] = [
  {
    id: 'a',
    name: 'A',
    venue_width: 50,
    venue_length: 50,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells: [],
    venue_elements: [],
    canvas_origin_x: 0,
    canvas_origin_y: 0,
  },
  {
    id: 'b',
    name: 'B',
    venue_width: 30,
    venue_length: 50,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells: [],
    venue_elements: [],
    canvas_origin_x: 50,
    canvas_origin_y: 0,
  },
]

const { doc, mergedId } = destructiveMergeInDoc(base, { roomIds: ['a', 'b'] })

expect('merged id is a', mergedId === 'a')
expect('single room in doc', (doc.rooms?.length ?? 0) === 1)
expect('union width 80', (doc.rooms?.[0]?.widthFt ?? 0) === 80)
expect('b2 still in doc', doc.objects.some((o) => o.id === 'b2'))
expect('b2 owned by merged room', doc.objectRoom?.b2 === 'a')

const projected = legacyRoomsFromDoc(layoutRooms, doc)
console.log('projected ids', projected.map((r) => r.id))
console.log('merged frame', doc.rooms?.[0])
expect('projected drops removed room b', projected.length === 1)
expect('merged canvas origin at union min', projected[0]?.canvas_origin_x === 0)
expect('merged width matches union', projected[0]?.venue_width === 80)
expect('b1 global x preserved', doc.objects.find((o) => o.id === 'b1')?.x === 5)
expect('b2 global x preserved', doc.objects.find((o) => o.id === 'b2')?.x === 55)

if (process.exitCode) process.exit(1)
console.log('Done.')
