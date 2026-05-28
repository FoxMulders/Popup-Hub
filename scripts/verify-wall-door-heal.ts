/**
 * Smoke test for the door-porting / wall-healing geometry.
 *
 * The same module exports the wall-segment computer that drives
 * `<CanvasObjects>`'s carve-and-heal rendering. We exercise it
 * directly here by replicating the function's logic so the unit
 * test never imports the React tree.
 *
 * The actual implementation lives in
 * `components/coordinator/floor-plan-v2/canvas/canvas-objects.tsx`.
 * To keep this script independent of the bundler we duplicate the
 * pure function below — keep them in sync if the carve algorithm
 * changes.
 */

import type { PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

interface WallInterval { from: number; to: number }

const WALL_CARVING_KINDS = new Set<PlacedObject['kind']>(['door', 'emergency_exit'])

function computeWallSegments(
  wall: PlacedObject,
  allObjects: ReadonlyArray<PlacedObject>,
  pxPerFt: number
): WallInterval[] | null {
  if (wall.kind !== 'wall') return null
  if (wall.rotation && Math.abs(wall.rotation) > 0.5) return null

  const wallX = wall.x * pxPerFt
  const wallY = wall.y * pxPerFt
  const wallW = wall.width * pxPerFt
  const wallH = wall.height * pxPerFt
  const isHorizontal = wallW >= wallH
  const wallStart = isHorizontal ? wallX : wallY
  const wallEnd = isHorizontal ? wallX + wallW : wallY + wallH
  const wallShortFrom = isHorizontal ? wallY : wallX
  const wallShortTo = isHorizontal ? wallY + wallH : wallX + wallW

  const carveIntervals: WallInterval[] = []
  for (const other of allObjects) {
    if (!WALL_CARVING_KINDS.has(other.kind)) continue
    if (other.id === wall.id) continue
    const ox = other.x * pxPerFt
    const oy = other.y * pxPerFt
    const ow = other.width * pxPerFt
    const oh = other.height * pxPerFt
    const shortTolerance = Math.max(2, pxPerFt * 0.25)
    const shortHit = isHorizontal
      ? oy + oh >= wallShortFrom - shortTolerance &&
        oy <= wallShortTo + shortTolerance
      : ox + ow >= wallShortFrom - shortTolerance &&
        ox <= wallShortTo + shortTolerance
    if (!shortHit) continue
    const longFrom = isHorizontal ? ox : oy
    const longTo = isHorizontal ? ox + ow : oy + oh
    const carveFrom = Math.max(wallStart, longFrom)
    const carveTo = Math.min(wallEnd, longTo)
    if (carveTo > carveFrom) {
      carveIntervals.push({ from: carveFrom, to: carveTo })
    }
  }

  if (carveIntervals.length === 0) {
    return [{ from: wallStart, to: wallEnd }]
  }

  carveIntervals.sort((a, b) => a.from - b.from)
  const merged: WallInterval[] = [carveIntervals[0]!]
  for (let i = 1; i < carveIntervals.length; i++) {
    const last = merged[merged.length - 1]!
    const cur = carveIntervals[i]!
    if (cur.from <= last.to) {
      last.to = Math.max(last.to, cur.to)
    } else {
      merged.push({ ...cur })
    }
  }

  const visible: WallInterval[] = []
  let cursor = wallStart
  for (const c of merged) {
    if (c.from > cursor) visible.push({ from: cursor, to: c.from })
    cursor = Math.max(cursor, c.to)
  }
  if (cursor < wallEnd) visible.push({ from: cursor, to: wallEnd })
  return visible.filter((iv) => iv.to - iv.from > 1)
}

let failed = 0
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

const PX_PER_FT = 10

function obj(
  id: string,
  kind: PlacedObject['kind'],
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0
): PlacedObject {
  return { id, kind, x, y, width: w, height: h, rotation } as PlacedObject
}

console.log('Carve and heal — horizontal wall')
{
  // Wall: 0..50 ft × y=0..1 ft (a 50' horizontal wall, 1 ft thick).
  const wall = obj('w', 'wall', 0, 0, 50, 1)
  // Door overlapping the wall at 20..23 ft.
  const door = obj('d', 'door', 20, 0, 3, 1)
  const segments = computeWallSegments(wall, [wall, door], PX_PER_FT)
  expect(
    'two visible sub-segments split around the door',
    segments,
    [
      { from: 0, to: 20 * PX_PER_FT },
      { from: 23 * PX_PER_FT, to: 50 * PX_PER_FT },
    ]
  )

  // Move the door away — wall heals back to a single segment.
  const movedDoor = obj('d', 'door', 200, 200, 3, 1)
  const healed = computeWallSegments(wall, [wall, movedDoor], PX_PER_FT)
  expect(
    'wall heals to a single span when door moves off-segment',
    healed,
    [{ from: 0, to: 50 * PX_PER_FT }]
  )
}

console.log('Carve — emergency exit also carves')
{
  const wall = obj('w', 'wall', 0, 0, 30, 1)
  const exit = obj('x', 'emergency_exit', 5, 0, 4, 1)
  const segments = computeWallSegments(wall, [wall, exit], PX_PER_FT)
  expect(
    'wall split around the exit',
    segments,
    [
      { from: 0, to: 5 * PX_PER_FT },
      { from: 9 * PX_PER_FT, to: 30 * PX_PER_FT },
    ]
  )
}

console.log('Carve — vertical wall splits along the y-axis')
{
  const wall = obj('w', 'wall', 0, 0, 1, 40)
  const door = obj('d', 'door', 0, 10, 1, 3)
  const segments = computeWallSegments(wall, [wall, door], PX_PER_FT)
  expect(
    'vertical wall split around the door',
    segments,
    [
      { from: 0, to: 10 * PX_PER_FT },
      { from: 13 * PX_PER_FT, to: 40 * PX_PER_FT },
    ]
  )
}

console.log('Carve — door flush against outer face of wall (zero overlap)')
{
  const wall = obj('w', 'wall', 0, 0, 30, 1)
  // Door sitting just below the wall (top of door = bottom of wall).
  const door = obj('d', 'door', 5, 1.0, 4, 1)
  const segments = computeWallSegments(wall, [wall, door], PX_PER_FT)
  expect(
    'flush-on-outer-face still carves (within short-axis tolerance)',
    segments,
    [
      { from: 0, to: 5 * PX_PER_FT },
      { from: 9 * PX_PER_FT, to: 30 * PX_PER_FT },
    ]
  )
}

console.log('Carve — door more than 0.25ft away → no carve, wall stays whole')
{
  const wall = obj('w', 'wall', 0, 0, 30, 1)
  // Door 0.5 ft below the wall — outside the tolerance.
  const door = obj('d', 'door', 5, 1.5, 4, 1)
  const segments = computeWallSegments(wall, [wall, door], PX_PER_FT)
  expect(
    'wall stays whole when door is detached on short axis',
    segments,
    [{ from: 0, to: 30 * PX_PER_FT }]
  )
}

console.log('Carve — multiple overlapping doors merge into one carve interval')
{
  const wall = obj('w', 'wall', 0, 0, 50, 1)
  const doorA = obj('a', 'door', 10, 0, 5, 1) // 10..15
  const doorB = obj('b', 'door', 14, 0, 5, 1) // 14..19 → overlaps A
  const segments = computeWallSegments(wall, [wall, doorA, doorB], PX_PER_FT)
  expect(
    'two overlapping doors carve a single 10..19 interval',
    segments,
    [
      { from: 0, to: 10 * PX_PER_FT },
      { from: 19 * PX_PER_FT, to: 50 * PX_PER_FT },
    ]
  )
}

console.log('Carve — booth/aisle/wall do NOT carve walls')
{
  const wall = obj('w', 'wall', 0, 0, 30, 1)
  const booth = obj('b', 'booth', 5, 0, 4, 1)
  const aisle = obj('a', 'aisle', 12, 0, 4, 1)
  const otherWall = obj('w2', 'wall', 18, 0, 4, 1)
  const openWall = obj('ow', 'open_wall', 22, 0, 4, 1)
  const segments = computeWallSegments(
    wall,
    [wall, booth, aisle, otherWall, openWall],
    PX_PER_FT
  )
  expect(
    'non-carving kinds leave the wall whole',
    segments,
    [{ from: 0, to: 30 * PX_PER_FT }]
  )
}

console.log('Carve — rotated wall falls back to a single rect (returns null)')
{
  const wall = obj('w', 'wall', 0, 0, 30, 1, 45)
  const door = obj('d', 'door', 5, 0, 4, 1)
  const segments = computeWallSegments(wall, [wall, door], PX_PER_FT)
  expect('rotated wall returns null (renders as single rect)', segments, null)
}

console.log('Heal — door drag scenario (source heals, destination carves)')
{
  // Two parallel walls. Door starts on wall A (top), then moves to wall B (bottom).
  const wallA = obj('A', 'wall', 0, 0, 30, 1)
  const wallB = obj('B', 'wall', 0, 20, 30, 1)
  // Initial: door on wall A.
  let door = obj('d', 'door', 10, 0, 4, 1)
  const beforeA = computeWallSegments(wallA, [wallA, wallB, door], PX_PER_FT)
  const beforeB = computeWallSegments(wallB, [wallA, wallB, door], PX_PER_FT)
  expect(
    'wall A is carved before the move',
    beforeA,
    [
      { from: 0, to: 10 * PX_PER_FT },
      { from: 14 * PX_PER_FT, to: 30 * PX_PER_FT },
    ]
  )
  expect('wall B is whole before the move', beforeB, [
    { from: 0, to: 30 * PX_PER_FT },
  ])

  // Move door to wall B.
  door = obj('d', 'door', 10, 20, 4, 1)
  const afterA = computeWallSegments(wallA, [wallA, wallB, door], PX_PER_FT)
  const afterB = computeWallSegments(wallB, [wallA, wallB, door], PX_PER_FT)
  expect('wall A heals to a single span after the move', afterA, [
    { from: 0, to: 30 * PX_PER_FT },
  ])
  expect(
    'wall B carves a path opening at the new position',
    afterB,
    [
      { from: 0, to: 10 * PX_PER_FT },
      { from: 14 * PX_PER_FT, to: 30 * PX_PER_FT },
    ]
  )
}

if (failed > 0) {
  console.log(`\n${failed} assertion(s) FAILED`)
  process.exit(1)
}
console.log('\nAll wall-door heal/carve assertions passed.')
