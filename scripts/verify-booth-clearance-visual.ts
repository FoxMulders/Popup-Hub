/**
 * Booth clearance color bands — 2′ / 3′ / 4′ foot thresholds.
 *
 * Run: npx tsx scripts/verify-booth-clearance-visual.ts
 */

import {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
  clearanceBand,
  edgeClearanceBetweenRects,
  minVendorBoothClearanceFt,
  vendorBoothClearanceThemeForProbe,
} from '../lib/coordinator/booth-clearance-visual'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(BOOTH_CLEARANCE_CRITICAL_FT === 2, 'critical threshold must be 2′')
assert(BOOTH_CLEARANCE_TIGHT_FT === 3, 'tight threshold must be 3′')
assert(BOOTH_CLEARANCE_GOOD_FT === 4, 'good threshold must be 4′')

assert(clearanceBand(2) === 'critical', '≤2′ is critical')
assert(clearanceBand(2.5) === 'critical', '<3′ stays critical (red until 3′)')
assert(clearanceBand(3) === 'tight', '≥3′ turns yellow')
assert(clearanceBand(3.5) === 'tight', '3.5′ is tight (not yet 4′ green)')
assert(clearanceBand(4) === 'good', '≥4′ is good')
assert(clearanceBand(Number.POSITIVE_INFINITY) === 'good', 'no neighbors is good')

const a = { x: 0, y: 0, width: 6, height: 4 }
const b = { x: 8, y: 0, width: 6, height: 4 }
assert(edgeClearanceBetweenRects(a, b) === 2, '2′ edge gap between booths')

const topLeft = { x: 0, y: 0, width: 4, height: 2 }
const bottomCenter = { x: 10, y: 20, width: 2, height: 4 }
assert(
  edgeClearanceBetweenRects(topLeft, bottomCenter) === 6,
  'diagonally separated booths use corner clearance, not zero'
)
assert(
  clearanceBand(edgeClearanceBetweenRects(topLeft, bottomCenter)) === 'good',
  'diagonally separated booths far apart are green'
)

const roomId = 'room-1'
const doc: FloorPlanDoc = {
  canvasWidthFt: 60,
  canvasLengthFt: 40,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: roomId,
      name: 'Main',
      originX: 10,
      originY: 5,
      widthFt: 40,
      lengthFt: 30,
    },
  ],
  objects: [],
  objectRoom: {},
}

const boothA = {
  id: 'a',
  kind: 'booth',
  x: 20,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
const boothB = {
  id: 'b',
  kind: 'booth',
  x: 28,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
doc.objects = [boothA, boothB]
doc.objectRoom = { a: roomId, b: roomId }

const gapA = minVendorBoothClearanceFt(
  boothA,
  doc.objects,
  doc.rooms,
  doc.objectRoom
)
const gapB = minVendorBoothClearanceFt(
  boothB,
  doc.objects,
  doc.rooms,
  doc.objectRoom
)
assert(gapA === 2 && gapB === 2, 'both booths share 2′ neighbor gap')
assert(
  clearanceBand(gapA) === 'critical' && clearanceBand(gapB) === 'critical',
  'both booths flag critical when 2′ apart'
)

// Placement preview — 3′ gap shows yellow before commit.
doc.objects = [boothA]
doc.objectRoom = { a: roomId }
const previewAt3 = {
  id: '__preview__',
  kind: 'booth',
  x: 29,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
const previewTheme = vendorBoothClearanceThemeForProbe(
  previewAt3,
  doc.objects,
  doc.rooms,
  doc.objectRoom,
  roomId
)
assert(
  previewTheme.fill === '#fef08a',
  '3′ preview probe uses tight (yellow) fill before placement'
)
assert(
  clearanceBand(
    minVendorBoothClearanceFt(previewAt3, doc.objects, doc.rooms, {
      ...doc.objectRoom,
      __preview__: roomId,
    })
  ) === 'tight',
  '3′ preview clearance band is tight'
)

// Restore paired-booth doc for scatter tests below.
doc.objects = [boothA, boothB]
doc.objectRoom = { a: roomId, b: roomId }

// Scatter layout — diagonally separated booths must not read as 0′ (all red).
{
  const scatterDoc: FloorPlanDoc = {
    canvasWidthFt: 60,
    canvasLengthFt: 60,
    gridSpacingFt: 1,
    snapFt: 1,
    rooms: [
      {
        id: 'scatter-room',
        name: 'Main',
        originX: 0,
        originY: 0,
        widthFt: 36,
        lengthFt: 36,
      },
    ],
    objects: [],
    objectRoom: {},
  }
  const scatterPositions = [
    { id: 's-a', x: 8, y: 8 },
    { id: 's-b', x: 22, y: 14 },
    { id: 's-c', x: 22, y: 24 },
    { id: 's-d', x: 8, y: 28 },
  ]
  for (const p of scatterPositions) {
    const booth = {
      id: p.id,
      kind: 'booth',
      x: p.x,
      y: p.y,
      width: 6,
      height: 2,
      rotation: 0,
      tablePurpose: 'vendor',
    } as BoothObject
    scatterDoc.objects.push(booth)
    scatterDoc.objectRoom![p.id] = 'scatter-room'
  }
  for (const booth of scatterDoc.objects as BoothObject[]) {
    const minFt = minVendorBoothClearanceFt(
      booth,
      scatterDoc.objects,
      scatterDoc.rooms,
      scatterDoc.objectRoom
    )
    assert(
      minFt > 0,
      `${booth.id} must not read as 0′ clearance (diagonal false positive)`
    )
  }
}

console.log('verify-booth-clearance-visual: all checks passed')
