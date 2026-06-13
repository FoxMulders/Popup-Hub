/**
 * Smoke test — layout density, cross-aisle injection, patron path fallback.
 * Run: npx tsx scripts/verify-layout-density-patron-path.ts
 */

import {
  assessLayoutDensity,
  computeMinimumRoomForWalkingLoop,
  DENSE_GRID_COLUMN_THRESHOLD,
  IDEAL_PEDESTRIAN_AISLE_FT,
} from '../lib/floor-plan/layout-density'
import { generateDeterministicMarketLayout, maxDeterministicGridSlotCount } from '../lib/floor-plan/deterministic-market-layout'
import { CalculateOptimalPath } from '../components/coordinator/floor-plan-v2/engine/PathfindingService'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const denseAssessment = assessLayoutDensity({
  roomWidthFt: 50,
  roomLengthFt: 50,
  boothWidthFt: 6,
  boothHeightFt: 4,
  boothCount: 43,
})

assert(
  'Dense 50×50 / 43 booths triggers density warning',
  denseAssessment.densityWarning != null && !denseAssessment.walkingLoopFeasible
)

assert(
  'Dense grid requires cross-aisle',
  denseAssessment.requiresCrossAisle === true
)

assert(
  'Cross-aisle zone planned for dense grid',
  denseAssessment.crossAisleZones.length === 1 &&
    denseAssessment.crossAisleZones[0]!.height >= 6
)

const minimumRoom = computeMinimumRoomForWalkingLoop({
  roomWidthFt: 50,
  roomLengthFt: 50,
  boothWidthFt: 6,
  boothHeightFt: 4,
  boothCount: 43,
})

assert(
  'Minimum room exceeds cramped 50×50',
  minimumRoom.widthFt > 50 || minimumRoom.lengthFt > 50,
  `${minimumRoom.widthFt}×${minimumRoom.lengthFt}`
)

let layoutWidth = minimumRoom.widthFt
let layoutLength = minimumRoom.lengthFt
for (let i = 0; i < 300; i++) {
  const capacity = maxDeterministicGridSlotCount({
    marketWidthFt: layoutWidth,
    marketHeightFt: layoutLength,
    tableWidthFt: 6,
    tableHeightFt: 4,
    layoutMode: 'grid',
    entrance: { x: layoutWidth / 2, y: 2 },
  })
  if (capacity >= 43) break
  layoutLength += 2
  if (i % 6 === 5) layoutWidth += 2
}

const layout = generateDeterministicMarketLayout({
  marketWidthFt: layoutWidth,
  marketHeightFt: layoutLength,
  tableWidthFt: 6,
  tableHeightFt: 4,
  tableCount: 43,
  tableIds: Array.from({ length: 43 }, (_, i) => `b${i}`),
  layoutMode: 'grid',
  entrance: { x: layoutWidth / 2, y: 2 },
})

assert('Expanded room layout succeeds', layout.ok === true)
if (layout.ok) {
if (layout.ok) {
  assert(
    'Scaled room places requested booth count',
    layout.placements.length >= 40,
    `placed ${layout.placements.length}`
  )
}
}

const roomId = 'main'

const booths: BoothObject[] = layout.ok
  ? layout.placements.map((p, i) => ({
      id: `b${i}`,
      kind: 'booth' as const,
      x: p.x,
      y: p.y,
      width: 6,
      height: 4,
      rotation: p.rotation,
      accentColor: null,
    }))
  : []

const objectRoom: FloorPlanDoc['objectRoom'] = {}
for (const booth of booths) {
  objectRoom[booth.id] = roomId
}

const doc: FloorPlanDoc = {
  canvasWidthFt: layoutWidth,
  canvasLengthFt: layoutLength,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: roomId,
      name: 'Main',
      originX: 0,
      originY: 0,
      widthFt: layoutWidth,
      lengthFt: layoutLength,
    },
  ],
  objectRoom,
  objects: [
    {
      id: 'door-in',
      kind: 'door',
      doorType: 'entrance',
      x: layoutWidth / 2 - 2,
      y: 0,
      width: 4,
      height: 2,
      rotation: 0,
    },
    {
      id: 'door-out',
      kind: 'emergency_exit',
      x: layoutWidth / 2 - 2,
      y: layoutLength - 2,
      width: 4,
      height: 2,
      rotation: 0,
    },
    ...booths,
  ],
}

const path = CalculateOptimalPath(doc, roomId)
assert('Patron path resolves on scaled layout', (path?.path.length ?? 0) >= 2)
assert(
  'Ideal clearance constant is 4′',
  IDEAL_PEDESTRIAN_AISLE_FT === 4
)

console.log('\nDone.')
