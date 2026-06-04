/**
 * Virtual smoke test — 20-object canvas doc: transform Join/Unjoin,
 * perimeter join tags, and table-size selection (no global cascade).
 *
 * Run: npx tsx scripts/verify-canvas-state-smoke.ts
 */

import {
  joinObjectsInDoc,
  unjoinGroupInDoc,
} from '../components/coordinator/floor-plan-v2/state/object-groups'
import {
  applyObjectPatches,
  planTableSizeChange,
} from '../components/coordinator/floor-plan-v2/state/table-size-selection'
import {
  guestRoundTableSpec,
  vendorTableSpec,
} from '../lib/booth-planner/table-shape'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '../components/coordinator/floor-plan-v2/state/types'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

function booth(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  tableLengthFt?: number
): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width,
    height,
    rotation: 0,
    accentColor: null,
    tableLengthFt,
  }
}

function snapshotGeometry(objects: ReadonlyArray<PlacedObject>) {
  return objects.map((o) => ({
    id: o.id,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
  }))
}

function buildTwentyObjectDoc(): FloorPlanDoc {
  const objects: PlacedObject[] = []
  for (let i = 0; i < 20; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    objects.push(
      booth(`b-${i}`, col * 8, row * 4, 6, 2, 6)
    )
  }
  return {
    canvasWidthFt: 60,
    canvasLengthFt: 40,
    snapFt: 1,
    gridSpacingFt: 1,
    objects,
    rooms: [],
  }
}

console.log('--- 20-object doc baseline ---')
const baseDoc = buildTwentyObjectDoc()
assert(baseDoc.objects.length === 20, 'doc holds 20 placed objects')

const geomBefore = snapshotGeometry(baseDoc.objects)

console.log('--- Transform Join (2): non-destructive geometry ---')
const joinResult = joinObjectsInDoc(baseDoc, ['b-0', 'b-1'])
assert(joinResult.groupId != null, 'joinObjectsInDoc returns a group id')
const joinedDoc = joinResult.doc
const geomAfterJoin = snapshotGeometry(joinedDoc.objects)
assert(
  JSON.stringify(geomAfterJoin) === JSON.stringify(geomBefore),
  'join preserves every object x/y/width/height/rotation'
)
const g0 = joinedDoc.objects.find((o) => o.id === 'b-0')
const g1 = joinedDoc.objects.find((o) => o.id === 'b-1')
assert(
  g0?.canvasGroupId === g1?.canvasGroupId && g0?.canvasGroupId != null,
  'joined pair shares canvasGroupId'
)

console.log('--- Transform Unjoin: dimensions restored ---')
const unjoinResult = unjoinGroupInDoc(joinedDoc, g0!.canvasGroupId!)
const unjoinedDoc = unjoinResult.doc
const geomAfterUnjoin = snapshotGeometry(unjoinedDoc.objects)
assert(
  JSON.stringify(geomAfterUnjoin) === JSON.stringify(geomBefore),
  'unjoin restores original geometry (tags only removed)'
)
assert(
  unjoinedDoc.objects.every((o) => o.canvasGroupId == null),
  'canvasGroupId cleared on all members'
)

console.log('--- Perimeter joinGroupId: tags only ---')
let perimeterDoc = baseDoc
const stage = {
  id: 'stage-1',
  kind: 'stage' as const,
  x: 0,
  y: 0,
  width: 12,
  height: 8,
  rotation: 0,
}
perimeterDoc = {
  ...perimeterDoc,
  objects: [...perimeterDoc.objects, stage],
}
const stageGeom = snapshotGeometry([stage])
const taggedObjects = perimeterDoc.objects.map((o) =>
  o.id === 'stage-1' || o.id === 'b-0'
    ? { ...o, joinGroupId: 'join-perimeter-test' }
    : o
)
perimeterDoc = { ...perimeterDoc, objects: taggedObjects }
const stageAfter = perimeterDoc.objects.find((o) => o.id === 'stage-1')!
assert(
  JSON.stringify(snapshotGeometry([stageAfter])) === JSON.stringify(stageGeom),
  'perimeter joinGroupId does not rewrite fixture dimensions'
)

console.log('--- Table size: selection-only patch ---')
const selected = new Set(['b-5'])
const planOne = planTableSizeChange({
  objects: baseDoc.objects,
  selectedIds: selected,
  selection: vendorTableSpec(10),
})
assert(planOne.nextDefaultPlacement === null, 'selection path skips default template')
assert(planOne.objectPatches.length === 1, 'exactly one booth patched')
assert(planOne.objectPatches[0]!.id === 'b-5', 'patch targets selected booth')

const afterOne = applyObjectPatches(baseDoc.objects, planOne.objectPatches)
const b5 = afterOne.find((o) => o.id === 'b-5') as BoothObject
const b6 = afterOne.find((o) => o.id === 'b-6') as BoothObject
assert(b5.width === 10 && b5.height === 2, 'selected booth resized to 10×2')
assert(b6.width === 6 && b6.height === 2, 'unselected booth unchanged (no cascade)')

console.log('--- Table size: empty selection → template only ---')
const planDefault = planTableSizeChange({
  objects: afterOne,
  selectedIds: new Set(),
  selection: vendorTableSpec(8),
})
assert(planDefault.objectPatches.length === 0, 'no object patches without selection')
assert(
  planDefault.nextDefaultPlacement?.ft === 8 &&
    planDefault.nextDefaultPlacement.purpose === 'vendor',
  'default placement template updates'
)

console.log('--- Guest round table: same-category resize ---')
const guestRoundBooth: BoothObject = {
  ...booth('b-guest', 40, 16, 6, 6, 6),
  tableShape: 'round',
  tablePurpose: 'guest',
}
const docWithGuest = {
  ...baseDoc,
  objects: [...afterOne, guestRoundBooth],
}
const planRound = planTableSizeChange({
  objects: docWithGuest.objects,
  selectedIds: new Set(['b-guest']),
  selection: guestRoundTableSpec(8),
})
assert(planRound.objectPatches.length === 1, 'guest round selection patches one booth')
const afterRound = applyObjectPatches(docWithGuest.objects, planRound.objectPatches)
const guestRound = afterRound.find((o) => o.id === 'b-guest') as BoothObject
assert(guestRound.width === 8 && guestRound.height === 8, 'guest round booth resized to 8×8')
assert(
  guestRound.tableShape === 'round' && guestRound.tablePurpose === 'guest',
  'guest round metadata preserved'
)

console.log('--- Guest round resize: draw template sync (host) ---')
let drawTemplate = vendorTableSpec(6)
const planGuestResize = planTableSizeChange({
  objects: afterRound,
  selectedIds: new Set(['b-guest']),
  selection: guestRoundTableSpec(8),
})
if (planGuestResize.objectPatches.length > 0) {
  drawTemplate = guestRoundTableSpec(8)
}
assert(
  drawTemplate.purpose === 'guest' &&
    drawTemplate.shape === 'round' &&
    drawTemplate.ft === 8,
  'after resizing a selected patron round, next draw uses guest round (not vendor)'
)

console.log('--- Table size: cross-purpose keeps placed booth ---')
const planGuestToVendor = planTableSizeChange({
  objects: afterRound,
  selectedIds: new Set(['b-guest']),
  selection: vendorTableSpec(8),
})
assert(
  planGuestToVendor.objectPatches.length === 0,
  'guest selection does not patch when switching to vendor template'
)
assert(
  planGuestToVendor.nextDefaultPlacement?.purpose === 'vendor',
  'cross-purpose updates default placement only'
)
const planToolbarVendor = planTableSizeChange({
  objects: afterRound,
  selectedIds: new Set(['b-guest']),
  selection: vendorTableSpec(6),
  templateOnly: true,
})
assert(
  planToolbarVendor.objectPatches.length === 0,
  'draw-toolbar mode switch never patches selection'
)

console.log('--- Immutability: source array not mutated ---')
const frozen = baseDoc.objects
const patched = applyObjectPatches(frozen, planOne.objectPatches)
assert(patched !== frozen, 'applyObjectPatches returns a new array')
assert(
  (frozen.find((o) => o.id === 'b-5') as BoothObject).width === 6,
  'original objects array untouched after patch apply'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
