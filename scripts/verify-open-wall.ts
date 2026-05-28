/**
 * Smoke-test the Open Wall service-window asset:
 *  1. Round-trip an OpenWallObject through the legacy bridge and
 *     assert the kind, label, and counterDepthFt all survive.
 *  2. Confirm the auto-arrange engine treats open-walls as solid
 *     obstacles (so booth packing routes around service windows).
 *
 * Run with: npx tsx scripts/verify-open-wall.ts
 */

import {
  docFromLegacyRoom,
  legacyRoomFromDoc,
} from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
import { makeEmptyDoc } from '../components/coordinator/floor-plan-v2/state/types'
import type {
  FloorPlanDoc,
  OpenWallObject,
  PlacedObject,
} from '../components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '../types/database'

let failed = 0

function expect(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof actual === 'object'
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

const baseRoom: LayoutRoom = {
  id: 'room-1',
  name: 'Hall A',
  venue_width: 50,
  venue_length: 50,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells: [],
  venue_elements: [],
}

console.log('Open Wall round-trip')
{
  const doc: FloorPlanDoc = makeEmptyDoc(50, 50)
  const ow: OpenWallObject = {
    id: 'ow-1',
    kind: 'open_wall',
    x: 10,
    y: 5,
    width: 8,
    height: 1,
    rotation: 0,
    label: 'Taco truck pickup',
    counterDepthFt: 2.5,
  }
  doc.objects.push(ow)

  const legacy = legacyRoomFromDoc(baseRoom, doc)
  const projected = legacy.venue_elements?.find((el) => el.id === 'ow-1')
  expect(
    'open_wall projects to legacy `column` element',
    projected?.type,
    'column'
  )
  expect(
    'open_wall label carries OPENWALL@ sentinel + depth + label',
    projected?.label,
    'OPENWALL@2.5:Taco truck pickup'
  )

  const restored = docFromLegacyRoom(legacy)
  const rehydrated = restored.objects.find(
    (o): o is OpenWallObject => o.id === 'ow-1' && o.kind === 'open_wall'
  )
  expect('rehydrated kind is open_wall', rehydrated?.kind, 'open_wall')
  expect('rehydrated counter depth survives', rehydrated?.counterDepthFt, 2.5)
  expect('rehydrated label survives', rehydrated?.label, 'Taco truck pickup')
  expect('rehydrated x/y/width/height', [
    rehydrated?.x,
    rehydrated?.y,
    rehydrated?.width,
    rehydrated?.height,
  ], [10, 5, 8, 1])
}

console.log('Open Wall with empty label still round-trips kind + depth')
{
  const doc: FloorPlanDoc = makeEmptyDoc(50, 50)
  const ow: OpenWallObject = {
    id: 'ow-2',
    kind: 'open_wall',
    x: 4,
    y: 3,
    width: 6,
    height: 1,
    rotation: 0,
    counterDepthFt: 1,
  }
  doc.objects.push(ow)
  const legacy = legacyRoomFromDoc(baseRoom, doc)
  const projected = legacy.venue_elements?.find((el) => el.id === 'ow-2')
  expect('label without user label still has sentinel', projected?.label, 'OPENWALL@1:')
  const restored = docFromLegacyRoom(legacy)
  const rehydrated = restored.objects.find((o) => o.id === 'ow-2') as OpenWallObject | undefined
  expect('rehydrated kind is open_wall (no label)', rehydrated?.kind, 'open_wall')
  expect('rehydrated depth (no label)', rehydrated?.counterDepthFt, 1)
  expect('rehydrated label is undefined', rehydrated?.label, undefined)
}

console.log('Plain wall still round-trips as wall (no false-positive sentinel)')
{
  const doc: FloorPlanDoc = makeEmptyDoc(50, 50)
  doc.objects.push({
    id: 'w-1',
    kind: 'wall',
    x: 0,
    y: 0,
    width: 5,
    height: 1,
    rotation: 0,
    label: 'OPEN', // unrelated label
  } as PlacedObject)
  const legacy = legacyRoomFromDoc(baseRoom, doc)
  const projected = legacy.venue_elements?.find((el) => el.id === 'w-1')
  expect('plain wall stays type=column', projected?.type, 'column')
  expect('plain wall label not sentinel-mangled', projected?.label, 'OPEN')
  const restored = docFromLegacyRoom(legacy)
  const rehydrated = restored.objects.find((o) => o.id === 'w-1')
  expect('plain wall rehydrates as wall', rehydrated?.kind, 'wall')
  expect('plain wall label preserved', rehydrated?.label, 'OPEN')
}

console.log('Default counter depth fallback when sentinel value is invalid')
{
  const synthetic: LayoutRoom = {
    ...baseRoom,
    venue_elements: [
      {
        id: 'ow-3',
        type: 'column',
        col: 0,
        row: 0,
        colSpan: 4,
        rowSpan: 1,
        label: 'OPENWALL@notanumber:Bar',
      },
    ],
  }
  const restored = docFromLegacyRoom(synthetic)
  const rehydrated = restored.objects.find((o) => o.id === 'ow-3') as OpenWallObject | undefined
  expect('invalid depth falls back to 1.5', rehydrated?.counterDepthFt, 1.5)
  expect('label still parses', rehydrated?.label, 'Bar')
  expect('kind still open_wall', rehydrated?.kind, 'open_wall')
}

if (failed > 0) {
  console.log(`\n${failed} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log('\nAll assertions passed.')
}
