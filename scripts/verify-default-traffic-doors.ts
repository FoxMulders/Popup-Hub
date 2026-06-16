/**
 * Smoke test — default movable entry/exit doors on new floor-plan rooms.
 */
import assert from 'node:assert/strict'
import { makeDefaultMainHallFrame } from '../components/coordinator/floor-plan-v2/state/canvas-init'
import { ensureDefaultTrafficDoors } from '../components/coordinator/floor-plan-v2/state/ensure-default-traffic-doors'
import { evaluateTrafficFlowPrerequisites } from '../components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import { makeEmptyDoc } from '../components/coordinator/floor-plan-v2/state/types'

const hall = makeDefaultMainHallFrame()
const base = {
  ...makeEmptyDoc(50, 50),
  rooms: [hall],
  objects: [],
  objectRoom: {},
}

const seeded = ensureDefaultTrafficDoors(base)
assert.equal(seeded.objects.length, 2, 'expected one entry and one exit')

const entry = seeded.objects.find(
  (o) => o.kind === 'door' && (o as { doorType?: string }).doorType === 'entrance'
)
const exit = seeded.objects.find((o) => o.kind === 'emergency_exit')
assert.ok(entry, 'missing entrance door')
assert.ok(exit, 'missing emergency exit')
assert.equal(entry!.locked, false, 'entrance should be movable')
assert.equal(exit!.locked, false, 'exit should be movable')
  assert.equal(seeded.objectRoom?.[entry!.id], hall.id)
  assert.equal(seeded.objectRoom?.[exit!.id], hall.id)

const prereq = evaluateTrafficFlowPrerequisites(seeded, hall.id)
assert.equal(prereq.satisfied, true, 'traffic prerequisites should be satisfied')

const again = ensureDefaultTrafficDoors(seeded)
assert.equal(again.objects.length, 2, 'should not duplicate doors')

console.log('verify-default-traffic-doors: PASS')
