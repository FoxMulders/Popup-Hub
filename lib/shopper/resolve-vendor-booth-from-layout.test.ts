import assert from 'node:assert/strict'
import test from 'node:test'
import type { BoothLayout, LayoutRoom } from '@/types/database'
import { MAIN_HALL_ROOM_ID } from '@/components/coordinator/floor-plan-v2/state/canvas-init'
import {
  resolveVendorBoothHighlightFromLayout,
  vendorDisplayNamesForLayoutMatch,
} from '@/lib/shopper/resolve-vendor-booth-from-layout'

const vendorUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const baseRoom: LayoutRoom = {
  id: MAIN_HALL_ROOM_ID,
  name: 'Main Hall',
  venue_width: 40,
  venue_length: 30,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells: [],
  venue_elements: [],
}

function layoutWithCells(cells: LayoutRoom['cells']): BoothLayout {
  return {
    id: 'layout-1',
    event_id: 'event-1',
    layout_rooms: [{ ...baseRoom, cells }],
    active_room_id: MAIN_HALL_ROOM_ID,
    spacing_mode: 'standard',
    created_at: '',
    updated_at: '',
  } as BoothLayout
}

test('resolveVendorBoothHighlightFromLayout prefers assignedVendorId over stale application booth_number', () => {
  const layout = layoutWithCells([
    {
      id: 'obj-1',
      col: 2,
      row: 2,
      colSpan: 6,
      rowSpan: 4,
      vendorName: 'Tipsy Fox',
      categoryName: 'Craft',
      categoryColor: '#94a3b8',
      boothNumber: 3,
      assignedVendorId: vendorUserId,
    },
    {
      id: 'obj-2',
      col: 10,
      row: 2,
      colSpan: 6,
      rowSpan: 4,
      vendorName: 'Other Vendor',
      categoryName: 'Food',
      categoryColor: '#94a3b8',
      boothNumber: 5,
    },
  ])

  const resolved = resolveVendorBoothHighlightFromLayout(layout, {
    vendorUserId,
    applicationBoothNumber: 5,
    vendorDisplayNames: ['Tipsy Fox'],
  })

  assert.equal(resolved, 3)
})

test('resolveVendorBoothHighlightFromLayout matches vendor display name when assignedVendorId missing', () => {
  const layout = layoutWithCells([
    {
      id: 'obj-1',
      col: 2,
      row: 2,
      colSpan: 6,
      rowSpan: 4,
      vendorName: 'Tipsy Fox Creations',
      categoryName: 'Craft',
      categoryColor: '#94a3b8',
      boothNumber: 7,
    },
  ])

  const resolved = resolveVendorBoothHighlightFromLayout(layout, {
    vendorUserId,
    applicationBoothNumber: 2,
    vendorDisplayNames: ['Tipsy Fox Creations'],
  })

  assert.equal(resolved, 7)
})

test('resolveVendorBoothHighlightFromLayout ignores stale application booth_number', () => {
  const layout = layoutWithCells([
    {
      id: 'obj-1',
      col: 2,
      row: 2,
      colSpan: 6,
      rowSpan: 4,
      vendorName: 'Unassigned',
      categoryName: 'Craft',
      categoryColor: '#94a3b8',
      boothNumber: 1,
    },
  ])

  const resolved = resolveVendorBoothHighlightFromLayout(layout, {
    vendorUserId,
    applicationBoothNumber: 9,
    vendorDisplayNames: [],
  })

  assert.equal(resolved, null)
})

test('vendorDisplayNamesForLayoutMatch dedupes business and profile names', () => {
  const names = vendorDisplayNamesForLayoutMatch(
    { business_name: 'Tipsy Fox' },
    { full_name: 'Tipsy Fox' }
  )
  assert.deepEqual(names, ['Tipsy Fox'])
})
