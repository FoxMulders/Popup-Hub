import assert from 'node:assert/strict'
import { makeEmptyDoc } from '../components/coordinator/floor-plan-v2/state/types'
import { forceRecomputeGeometry } from '../components/coordinator/floor-plan-v2/state/geometry-sanitize'
import {
  buildWizardGenericVendorBooths,
  runWizardInitialLayout,
  shouldRunWizardInitialLayout,
} from '../lib/floor-plan/wizard-initial-layout'
import { createLayoutRoom } from '../lib/booth-planner/layout-rooms'

function mainHallDoc(widthFt: number, lengthFt: number) {
  const room = createLayoutRoom('Main Hall', {
    venue_width: widthFt,
    venue_length: lengthFt,
  })
  return forceRecomputeGeometry({
    ...makeEmptyDoc(widthFt, lengthFt),
    rooms: [
      {
        id: room.id,
        name: room.name,
        originX: 0,
        originY: 0,
        widthFt,
        lengthFt,
      },
    ],
    objects: [],
    objectRoom: {},
  })
}

const slots = [
  { categoryId: 'c1', categoryName: 'Crafts', maxSlots: 4 },
  { categoryId: 'c2', categoryName: 'Food', maxSlots: 3 },
]

const booths = buildWizardGenericVendorBooths(slots, {
  baselineTableLengthFt: 6,
  layoutCapacity: 20,
})
assert.equal(booths.length, 7, 'round-robin placeholders match total caps')
assert.ok(
  booths.every((b) => b.label === 'Generic Vendor Booth' && b.categoryName),
  'placeholders carry category names'
)

const doc = mainHallDoc(74, 74)
const roomId = doc.rooms![0]!.id
const emptyRoom = createLayoutRoom('Main Hall', { venue_width: 74, venue_length: 74 })

assert.equal(
  shouldRunWizardInitialLayout([emptyRoom], doc, slots),
  true,
  'blank room list should allow initial layout'
)

const withCells = [
  {
    ...emptyRoom,
    cells: [{ id: 'v1', col: 0, row: 0, colSpan: 1, rowSpan: 1 } as never],
  },
]
assert.equal(
  shouldRunWizardInitialLayout(withCells, doc, slots),
  false,
  'saved booth cells skip auto seed'
)

const result = runWizardInitialLayout({
  doc,
  roomId,
  categorySlots: slots,
  baselineTableLengthFt: 6,
  layoutCapacity: 20,
  eventCategoryNames: ['Crafts', 'Food'],
})

assert.ok(result.placedCount > 0, 'grid auto-arrange places booths in 74×74 Main Hall')
assert.ok(
  result.doc.objects.every((o) => o.x >= 0 && o.y >= 0),
  'placed booths sit on canvas, not staging sentinel'
)

const xs = result.doc.objects.map((o) => o.x)
const ys = result.doc.objects.map((o) => o.y)
assert.ok(Math.min(...xs) >= 0 && Math.min(...ys) >= 0, 'layout starts inside room origin')

console.log(
  `PASS verify-wizard-initial-layout — placed ${result.placedCount}/${result.requestedCount} in 74×74 Main Hall`
)
