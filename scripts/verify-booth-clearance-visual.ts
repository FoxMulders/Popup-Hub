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
} from '../lib/coordinator/booth-clearance-visual'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(BOOTH_CLEARANCE_CRITICAL_FT === 2, 'critical threshold must be 2′')
assert(BOOTH_CLEARANCE_TIGHT_FT === 3, 'tight threshold must be 3′')
assert(BOOTH_CLEARANCE_GOOD_FT === 4, 'good threshold must be 4′')

assert(clearanceBand(2) === 'critical', '≤2′ is critical')
assert(clearanceBand(2.5) === 'tight', 'between 2′ and 4′ is tight')
assert(clearanceBand(3) === 'tight', '≤3′ is tight when >2′')
assert(clearanceBand(3.5) === 'tight', '3.5′ is tight (not yet 4′ green)')
assert(clearanceBand(4) === 'good', '≥4′ is good')
assert(clearanceBand(Number.POSITIVE_INFINITY) === 'good', 'no neighbors is good')

const a = { x: 0, y: 0, width: 6, height: 4 }
const b = { x: 8, y: 0, width: 6, height: 4 }
assert(edgeClearanceBetweenRects(a, b) === 2, '2′ edge gap between booths')

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

console.log('verify-booth-clearance-visual: all checks passed')
