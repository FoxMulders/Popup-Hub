/**
 * Smoke test: perimeter wall macro geometry + duplicate detection +
 * room/canvas fallback resolution.
 *
 * Run with `tsx scripts/verify-perimeter-walls.ts`.
 *
 * History: this file used to also exercise the canvas edge
 * auto-scroll velocity math, but the auto-scroll dampening loop was
 * reverted to restore the original snappier drag behavior. Only the
 * perimeter-wall checks remain.
 */
import {
  buildPerimeterWalls,
  PERIMETER_WALL_LABEL,
  PERIMETER_WALL_THICKNESS_FT,
  resolvePerimeterTarget,
  targetHasPerimeterWalls,
} from '../components/coordinator/floor-plan-v2/interactions/perimeter-walls'
import type { RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'

let failed = 0
function expect(cond: boolean, label: string) {
  if (cond) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}`)
  }
}

// -----------------------------------------------------------------------------
// buildPerimeterWalls — geometry
// -----------------------------------------------------------------------------
{
  let counter = 0
  const idGen = () => `wall-fixture-${++counter}`
  const walls = buildPerimeterWalls(
    { originX: 10, originY: 20, widthFt: 40, lengthFt: 30 },
    { idGen }
  )
  expect(walls.length === 4, 'macro emits exactly four walls')
  expect(
    walls.every((w) => w.kind === 'wall'),
    'every emitted object is a WallObject'
  )
  expect(
    walls.every((w) => w.locked === true),
    'every macro wall is locked'
  )
  expect(
    walls.every((w) => w.label === PERIMETER_WALL_LABEL),
    'every macro wall carries the PERIMETER_WALL_LABEL sentinel'
  )

  const t = PERIMETER_WALL_THICKNESS_FT
  const top = walls.find((w) => w.id === 'wall-fixture-1')!
  const right = walls.find((w) => w.id === 'wall-fixture-2')!
  const bottom = walls.find((w) => w.id === 'wall-fixture-3')!
  const left = walls.find((w) => w.id === 'wall-fixture-4')!

  expect(
    top.x === 10 && top.y === 20 && top.width === 40 && top.height === t,
    'top wall spans the full width along the top edge'
  )
  expect(
    right.x === 10 + 40 - t &&
      right.y === 20 &&
      right.width === t &&
      right.height === 30,
    'right wall sits on the inner-right face'
  )
  expect(
    bottom.x === 10 &&
      bottom.y === 20 + 30 - t &&
      bottom.width === 40 &&
      bottom.height === t,
    'bottom wall sits on the inner-bottom face'
  )
  expect(
    left.x === 10 && left.y === 20 && left.width === t && left.height === 30,
    'left wall spans the full height along the left edge'
  )
}

// -----------------------------------------------------------------------------
// targetHasPerimeterWalls — duplicate detection
// -----------------------------------------------------------------------------
{
  const target = { originX: 0, originY: 0, widthFt: 50, lengthFt: 60 }
  const walls = buildPerimeterWalls(target)
  expect(
    targetHasPerimeterWalls(target, walls) === true,
    'predicate returns true after the macro runs'
  )
  expect(
    targetHasPerimeterWalls(target, []) === false,
    'predicate returns false on empty object list'
  )
  // Same coords but missing the locked flag should NOT trip it (so a
  // hand-drawn wall doesn't accidentally satisfy the predicate).
  const unlockedClones = walls.map((w) => ({ ...w, locked: false }))
  expect(
    targetHasPerimeterWalls(target, unlockedClones) === false,
    'predicate ignores walls without `locked: true` (user drew them)'
  )
}

// -----------------------------------------------------------------------------
// resolvePerimeterTarget — falls back gracefully
// -----------------------------------------------------------------------------
{
  const room: RoomFrame = {
    id: 'r1',
    name: 'Main hall',
    originX: 5,
    originY: 7,
    widthFt: 100,
    lengthFt: 80,
  }
  const fromRoom = resolvePerimeterTarget([room], 'r1', 200, 200)
  expect(
    fromRoom.originX === 5 &&
      fromRoom.originY === 7 &&
      fromRoom.widthFt === 100 &&
      fromRoom.lengthFt === 80,
    'resolvePerimeterTarget picks the active room rect'
  )
  const fallback = resolvePerimeterTarget(undefined, null, 200, 150)
  expect(
    fallback.originX === 0 &&
      fallback.originY === 0 &&
      fallback.widthFt === 200 &&
      fallback.lengthFt === 150,
    'resolvePerimeterTarget falls back to the canvas rect when no room'
  )
  const noMatch = resolvePerimeterTarget([room], 'missing', 200, 150)
  expect(
    noMatch.originX === 0 && noMatch.widthFt === 200,
    'resolvePerimeterTarget falls back to canvas rect when active id misses'
  )
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll perimeter-wall checks passed.')
