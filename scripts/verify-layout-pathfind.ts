/**
 * Smoke test — PackBooths + CalculateOptimalPath on a simple room doc.
 * Run: npx tsx scripts/verify-layout-pathfind.ts
 */

import {
  PackBooths,
  applyPackedBoothsToDoc,
} from '../components/coordinator/floor-plan-v2/engine/BoothArrangementEngine'
import {
  CalculateOptimalPath,
  buildNavigationGrid,
  pathPointsAreWalkable,
} from '../components/coordinator/floor-plan-v2/engine/PathfindingService'
import { rotatedAabb } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import { MIN_CLEARANCE_FT } from '../lib/booth-planner/layout-clearance-constants'
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

function assert(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
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
const grid = buildNavigationGrid(packedDoc, roomId)

const packOk = pack.placedCount >= 3
const pathOk = (path?.path.length ?? 0) >= 2
const visitOk = (path?.visitOrder.length ?? 0) === booths.length
const doorsOk = path?.missingDoors !== true
const walkableOk =
  path != null && grid != null ? pathPointsAreWalkable(path.path, grid) : false

const entryDoor = packedDoc.objects.find((o) => o.id === 'door-in')!
const entryCenter = (() => {
  const aabb = rotatedAabb(entryDoor)
  return { x: aabb.x + aabb.width / 2, y: aabb.y + aabb.height / 2 }
})()
const start = path?.path[0]
const startNearEntry =
  start != null
    ? Math.hypot(start.x - entryCenter.x, start.y - entryCenter.y) <= 12
    : false

function pathNearBooth(boothId: string): boolean {
  const boothObj = packedDoc.objects.find((o) => o.id === boothId)
  if (!boothObj || !path) return false
  const aabb = rotatedAabb(boothObj)
  const margin = MIN_CLEARANCE_FT + 1
  return path.path.some(
    (p) =>
      p.x >= aabb.x - margin &&
      p.x <= aabb.x + aabb.width + margin &&
      p.y >= aabb.y - margin &&
      p.y <= aabb.y + aabb.height + margin
  )
}

const allBoothsVisited = booths.every((b) => pathNearBooth(b.id))
const smoothedOk =
  path != null &&
  path.path.length <=
    booths.length * 40 + 20

console.log('=== Auto-Layout & Pathfind ===')
assert('PackBooths placed booths', packOk, `${pack.placedCount}/${booths.length}`)
assert('Patron path has points', pathOk, `${path?.path.length ?? 0} points`)
assert('Visits all vendor booths', visitOk, `${path?.visitOrder.length ?? 0}/${booths.length}`)
assert('Uses entry door (not missingDoors)', doorsOk)
assert('Path starts near entry door', startNearEntry)
assert('Path passes near every booth footprint', allBoothsVisited)
assert('All path points on walkable grid', walkableOk)
assert('Smoothed path is not per-cell staircase', smoothedOk, `${path?.path.length ?? 0} points`)

if (process.exitCode && process.exitCode !== 0) process.exit(1)
