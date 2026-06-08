/**
 * Smoke test — PackBooths + CalculateOptimalPath on a simple room doc.
 * Run: npx tsx scripts/verify-layout-pathfind.ts
 */

import {
  PackBooths,
  applyPackedBoothsToDoc,
} from '../components/coordinator/floor-plan-v2/engine/BoothArrangementEngine'
import { CalculateOptimalPath } from '../components/coordinator/floor-plan-v2/engine/PathfindingService'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

const roomId = 'room-main'

function booth(id: string, w: number, h: number): BoothObject {
  return {
    id,
    kind: 'booth',
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    tablePurpose: 'vendor',
  }
}

const doc: FloorPlanDoc = {
  canvasWidthFt: 80,
  canvasLengthFt: 60,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: roomId,
      name: 'Main',
      originX: 0,
      originY: 0,
      widthFt: 80,
      lengthFt: 60,
    },
  ],
  objectRoom: {},
  objects: [
    {
      id: 'door-in',
      kind: 'door',
      doorType: 'entrance',
      x: 38,
      y: 0,
      width: 4,
      height: 2,
      rotation: 0,
    },
    {
      id: 'door-out',
      kind: 'door',
      doorType: 'exit',
      x: 38,
      y: 58,
      width: 4,
      height: 2,
      rotation: 0,
    },
    booth('b1', 8, 6),
    booth('b2', 8, 6),
    booth('b3', 8, 6),
    booth('b4', 8, 6),
  ],
}

for (const o of doc.objects) {
  doc.objectRoom![o.id] = roomId
}

const booths = doc.objects.filter((o): o is BoothObject => o.kind === 'booth')
const cleared = booths.map((b) => ({ ...b, x: 0, y: 0, rotation: 0 }))
const pack = PackBooths(doc, roomId, cleared)
const packedDoc = applyPackedBoothsToDoc(doc, roomId, pack.booths)
const path = CalculateOptimalPath(packedDoc, roomId)

const packOk = pack.placedCount >= 3
const pathOk = (path?.path.length ?? 0) >= 2
const visitOk = (path?.visitOrder.length ?? 0) === booths.length

console.log('=== Auto-Layout & Pathfind ===')
console.log(`${packOk ? 'PASS' : 'FAIL'}  PackBooths placed ${pack.placedCount}/${booths.length}`)
console.log(`${pathOk ? 'PASS' : 'FAIL'}  path has ${path?.path.length ?? 0} points`)
console.log(`${visitOk ? 'PASS' : 'FAIL'}  visits all ${booths.length} booths`)

if (!packOk || !pathOk || !visitOk) process.exit(1)
