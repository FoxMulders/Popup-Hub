/**
 * Layout tessellation + clearance auto-correction smoke tests.
 *
 * Run: npx tsx scripts/verify-layout-tessellation.ts
 */

import {
  TESSELLATION_PATTERNS,
  scoreFlowFairness,
} from '../lib/floor-plan/layout-tessellation-optimizer'
import {
  applyClearanceAutoCorrection,
  countGreenVendorBooths,
} from '../lib/floor-plan/clearance-auto-correction'
import { clearanceBand } from '../lib/coordinator/booth-clearance-visual'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(TESSELLATION_PATTERNS.length === 3, 'three tessellation patterns')
assert(
  TESSELLATION_PATTERNS.some((p) => p.id === 'perimeter-loop'),
  'perimeter-loop pattern'
)
assert(
  TESSELLATION_PATTERNS.some((p) => p.id === 'structured-grid'),
  'structured-grid pattern'
)
assert(
  TESSELLATION_PATTERNS.some((p) => p.id === 'staggered-offset'),
  'staggered-offset pattern'
)

const roomId = 'room-a'
const tightBoothA: BoothObject = {
  id: 'a',
  kind: 'booth',
  x: 4,
  y: 4,
  width: 6,
  height: 2,
  rotation: 0,
  accentColor: null,
}
const tightBoothB: BoothObject = {
  id: 'b',
  kind: 'booth',
  x: 12,
  y: 4,
  width: 6,
  height: 2,
  rotation: 0,
  accentColor: null,
}

const doc: FloorPlanDoc = {
  canvasWidthFt: 40,
  canvasLengthFt: 30,
  gridSpacingFt: 1,
  snapFt: 1,
  objects: [tightBoothA, tightBoothB],
  rooms: [
    {
      id: roomId,
      name: 'Hall',
      originX: 0,
      originY: 0,
      widthFt: 40,
      lengthFt: 30,
    },
  ],
  objectRoom: { a: roomId, b: roomId },
}

const before = countGreenVendorBooths(doc, roomId)
assert(before.total === 2, 'two vendor booths in fixture')

const corrected = applyClearanceAutoCorrection(doc, { roomId })
const after = countGreenVendorBooths(corrected.doc, roomId)
assert(
  after.green === after.total,
  `all booths green after correction (was ${before.green}/${before.total}, now ${after.green}/${after.total})`
)
assert(corrected.allGreen, 'allGreen flag set')

const fairness = scoreFlowFairness(corrected.doc, roomId)
assert(fairness >= 0 && fairness <= 1, 'flow fairness normalized 0–1')

assert(clearanceBand(4) === 'good', '4′ is green band')
assert(clearanceBand(2.5) === 'critical', '2.5′ triggers push-back/prune path')

console.log('verify-layout-tessellation: ok')
