/**
 * Verify room + stage boolean union and perimeter ring resolution.
 * Run: npx tsx scripts/verify-layout-merge-engine.ts
 */
import type { FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'
import {
  computeRoomStageUnion,
  isNonRectUnionRing,
  resolvePerimeterUnionRingForRoom,
  unionLayoutParticipants,
} from '../src/utils/layoutMergeEngine'
import { openRingVertices } from '../components/coordinator/floor-plan-v2/geometry/point-in-polygon'
import { resolveRoomPlacementSurface } from '../components/coordinator/floor-plan-v2/state/placement-surface'

let passed = 0
let failed = 0

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}`)
  }
}

const hallStageDoc: FloorPlanDoc = {
  canvasWidthFt: 50,
  canvasLengthFt: 50,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: 'room-main',
      name: 'Main Hall',
      originX: 0,
      originY: 0,
      widthFt: 50,
      lengthFt: 46,
    },
  ],
  objectRoom: { 'stage-1': 'room-main' },
  objects: [
    {
      id: 'stage-1',
      kind: 'stage',
      x: 2,
      y: 46,
      width: 40,
      height: 4,
      rotation: 0,
    },
  ],
}

const union = computeRoomStageUnion(hallStageDoc, 'room-main')
assert('room + stage union exists', union != null)
assert(
  'union ring has more than 4 vertices (L-shape)',
  union != null && isNonRectUnionRing(union.outerRing)
)
assert(
  'union dissolves shared edge (8 outer vertices for inset stage)',
  union != null && openRingVertices(union.outerRing as Array<[number, number]>).length === 8
)

const surface = resolveRoomPlacementSurface(hallStageDoc, 'room-main')
assert(
  'placement surface uses union ring',
  surface != null && surface.outerRings[0] != null && isNonRectUnionRing(surface.outerRings[0]!)
)

const ring = resolvePerimeterUnionRingForRoom(hallStageDoc, 'room-main')
assert('resolvePerimeterUnionRingForRoom returns union', ring != null && isNonRectUnionRing(ring))

const twoRoomDoc: FloorPlanDoc = {
  ...hallStageDoc,
  rooms: [
    hallStageDoc.rooms![0]!,
    {
      id: 'room-annex',
      name: 'Annex',
      originX: 50,
      originY: 0,
      widthFt: 20,
      lengthFt: 30,
    },
  ],
}

const twoRoomUnion = unionLayoutParticipants(twoRoomDoc.rooms!, [])
assert('two touching rooms union', twoRoomUnion != null)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
