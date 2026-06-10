/**
 * Smoke test — traffic-aware packBooths inside merged_zone with stage obstacle.
 * Run: npx tsx scripts/verify-auto-arrange-engine.ts
 */

import {
  packBoothsTrafficAware,
  buildTrafficNoFlyRects,
  ringToRoomPolygon,
  packBooths,
} from '../components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import { buildPatronPathway } from '../components/coordinator/floor-plan-v2/engine/patron-centric-layout'
import type { Position } from 'geojson'

const roomW = 80
const roomH = 60
const entrance = { x: roomW / 2, y: 2 }
const exit = { x: roomW / 2, y: roomH - 2 }

const booths = [
  { id: 'a', width: 8, height: 6 },
  { id: 'b', width: 8, height: 6 },
  { id: 'c', width: 8, height: 6 },
  { id: 'd', width: 8, height: 6 },
  { id: 'e', width: 8, height: 6 },
  { id: 'f', width: 8, height: 6 },
]

const pathway = buildPatronPathway(roomW, roomH, entrance, exit, 7, 6)
const noFly = buildTrafficNoFlyRects(pathway, 7)

const traffic = packBoothsTrafficAware(roomW, roomH, booths, {
  entrance,
  exit,
  obstacles: [{ x: 36, y: 28, width: 8, height: 6 }],
  aisleWidth: 3,
  stepFt: 0.5,
})

const roomPolygon: Position[][] = [
  [
    [0, 0],
    [80, 0],
    [80, 60],
    [0, 60],
    [0, 0],
  ],
]

const turfResult = packBooths(roomPolygon, booths, {
  entrance,
  exit,
  obstacles: [{ x: 36, y: 28, width: 8, height: 6, rotation: 0 }],
  aisleWidth: 3,
  stepFt: 1,
  wallInsetFt: 1,
})

const ring = ringToRoomPolygon([
  [0, 0],
  [80, 0],
  [80, 60],
  [0, 60],
  [0, 0],
])

console.log('=== Traffic-Aware AutoArrangeEngine ===')
console.log(`pathway points: ${pathway.length}, no-fly rects: ${noFly.length}`)
console.log(
  `traffic placed: ${traffic.placed.length}, unplaced: ${traffic.unplaced.length}, exposure shifts: ${traffic.meta?.exposureShifts ?? 0}`
)
console.log(
  `turf placed: ${turfResult.placed.length}, unplaced: ${turfResult.unplaced.length}`
)
console.log(`ring coords: ${ring[0]?.length ?? 0} points`)

const placedOk = traffic.placed.length >= 3
const noFlyOk = noFly.length >= pathway.length - 1
const metaOk = Boolean(traffic.meta?.pathway.length)
const turfOk = turfResult.placed.length >= 3

console.log(`${placedOk ? 'PASS' : 'FAIL'}  traffic-aware placed at least 3/6 booths`)
console.log(`${noFlyOk ? 'PASS' : 'FAIL'}  no-fly zone covers pathway segments`)
console.log(`${metaOk ? 'PASS' : 'FAIL'}  layout meta includes serpentine pathway`)
console.log(`${turfOk ? 'PASS' : 'FAIL'}  Turf validation keeps ≥3 booths in polygon`)

if (!placedOk || !noFlyOk || !metaOk || !turfOk) process.exit(1)
