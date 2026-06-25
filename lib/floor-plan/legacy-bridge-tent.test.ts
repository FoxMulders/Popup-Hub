import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docFromLegacyRooms,
  legacyRoomsFromDoc,
} from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'
import type { LayoutRoom } from '@/types/database'
import { MAIN_HALL_ROOM_ID } from '@/components/coordinator/floor-plan-v2/state/canvas-init'

const baseRoom: LayoutRoom = {
  id: MAIN_HALL_ROOM_ID,
  name: 'Main Lot',
  venue_width: 80,
  venue_length: 60,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  venue_profile: 'outdoor',
  cells: [],
  venue_elements: [],
}

test('legacy bridge round-trips tent vendor booths', () => {
  const rooms: LayoutRoom[] = [
    {
      ...baseRoom,
      cells: [
        {
          id: 'tent-1',
          col: 4,
          row: 6,
          colSpan: 10,
          rowSpan: 10,
          vendorName: 'Tent Vendor',
          categoryName: 'Craft',
          categoryColor: '#94a3b8',
          boothNumber: 1,
          vendorUnitType: 'tent',
          tableLengthFt: null,
        },
      ],
    },
  ]

  const doc = docFromLegacyRooms(rooms)
  const tent = doc.objects.find((o) => o.id === 'tent-1')
  assert.ok(tent && tent.kind === 'booth')
  assert.equal(tent.width, 10)
  assert.equal(tent.height, 10)
  assert.equal((tent as { vendorUnitType?: string }).vendorUnitType, 'tent')

  const roundTrip = legacyRoomsFromDoc(rooms, doc)
  const cell = roundTrip[0]?.cells[0]
  assert.ok(cell)
  assert.equal(cell.vendorUnitType, 'tent')
  assert.equal(cell.colSpan, 10)
  assert.equal(cell.rowSpan, 10)
})

test('legacy bridge round-trips outdoor venue profile on rooms', () => {
  const rooms: LayoutRoom[] = [{ ...baseRoom, venue_profile: 'outdoor' }]
  const doc = docFromLegacyRooms(rooms)
  assert.equal(doc.rooms?.[0]?.venueProfile, 'outdoor')

  const roundTrip = legacyRoomsFromDoc(rooms, doc)
  assert.equal(roundTrip[0]?.venue_profile, 'outdoor')
})

test('legacy bridge round-trips assigned vendor user id on booth cells', () => {
  const vendorUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const rooms: LayoutRoom[] = [
    {
      ...baseRoom,
      cells: [
        {
          id: 'obj-tent-1',
          col: 4,
          row: 6,
          colSpan: 10,
          rowSpan: 10,
          vendorName: 'Assigned Vendor',
          categoryName: 'Craft',
          categoryColor: '#94a3b8',
          boothNumber: 1,
          vendorUnitType: 'tent',
          assignedVendorId: vendorUserId,
        },
      ],
    },
  ]

  const doc = docFromLegacyRooms(rooms)
  const booth = doc.objects.find((o) => o.id === 'obj-tent-1')
  assert.ok(booth && booth.kind === 'booth')
  assert.equal((booth as { vendorId?: string | null }).vendorId, vendorUserId)

  const saved = legacyRoomsFromDoc(rooms, doc)
  assert.equal(saved[0]?.cells[0]?.assignedVendorId, vendorUserId)
})

test('legacy bridge writes assignedVendorId from booth vendorId on save', () => {
  const vendorUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const rooms: LayoutRoom[] = [
    {
      ...baseRoom,
      cells: [
        {
          id: 'obj-booth-1',
          col: 2,
          row: 2,
          colSpan: 6,
          rowSpan: 4,
          vendorName: 'Vendor A',
          categoryName: 'Craft',
          categoryColor: '#94a3b8',
          boothNumber: 1,
        },
      ],
    },
  ]

  const doc = docFromLegacyRooms(rooms)
  const booth = doc.objects.find((o) => o.kind === 'booth')
  assert.ok(booth)
  ;(booth as { vendorId?: string }).vendorId = vendorUserId

  const saved = legacyRoomsFromDoc(rooms, doc)
  assert.equal(saved[0]?.cells[0]?.assignedVendorId, vendorUserId)
})
