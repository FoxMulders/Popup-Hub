/**
 * Smoke test — Turf-validated packBooths inside merged_zone with stage obstacle.
 * Run: npx tsx scripts/verify-auto-arrange-engine.ts
 */

import {
  packBooths,
  ringToRoomPolygon,
} from '../components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import type { Position } from 'geojson'

const roomPolygon: Position[][] = [
  [
    [10, 10],
    [50, 10],
    [50, 40],
    [10, 40],
    [10, 10],
  ],
]

const stageObstacle = {
  x: 28,
  y: 22,
  width: 8,
  height: 6,
  rotation: 0,
}

const booths = [
  { id: 'a', width: 8, height: 6 },
  { id: 'b', width: 8, height: 6 },
  { id: 'c', width: 8, height: 6 },
  { id: 'd', width: 8, height: 6 },
  { id: 'e', width: 8, height: 6 },
  { id: 'f', width: 8, height: 6 },
  { id: 'g', width: 8, height: 6 },
  { id: 'h', width: 8, height: 6 },
  { id: 'i', width: 8, height: 6 },
  { id: 'j', width: 8, height: 6 },
]

const result = packBooths(roomPolygon, booths, {
  obstacles: [stageObstacle],
  aisleWidth: 5,
  stepFt: 1,
  wallInsetFt: 1,
})

const ring = ringToRoomPolygon([
  [10, 10],
  [50, 10],
  [50, 40],
  [10, 40],
  [10, 10],
])

console.log('=== AutoArrangeEngine (merged_zone shelf pack) ===')
console.log(`placed: ${result.placed.length}, unplaced: ${result.unplaced.length}`)
console.log(`ring coords: ${ring[0]?.length ?? 0} points`)

const placedOk = result.placed.length >= 4
const hasRotation = result.placed.every((p) => p.rotation === 0 || p.rotation === 90)
const unplacedOk = result.unplaced.every(
  (id) => !result.placed.some((p) => p.id === id)
)

console.log(`${placedOk ? 'PASS' : 'FAIL'}  placed at least 4/10 booths around stage`)
console.log(`${hasRotation ? 'PASS' : 'FAIL'}  rotations are 0° or 90°`)
console.log(`${unplacedOk ? 'PASS' : 'FAIL'}  unplaced ids disjoint from placed`)

if (!placedOk || !hasRotation || !unplacedOk) process.exit(1)
