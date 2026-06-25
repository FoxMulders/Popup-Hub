import assert from 'node:assert/strict'
import test from 'node:test'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '@/types/database'
import {
  collectBoothApplicationAssignments,
  resolveApplicationForVendorKey,
} from '@/lib/floor-plan/sync-booth-application-numbers'

const baseRoom = (id: string, cells: LayoutRoom['cells']): LayoutRoom => ({
  id,
  name: id,
  venue_width: 40,
  venue_length: 40,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells,
  venue_elements: [],
})

const vendorBooth = (id: string, vendorId: string): BoothObject => ({
  id,
  kind: 'booth',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  vendorId,
  tablePurpose: 'vendor',
})

test('resolveApplicationForVendorKey matches vendor_id and legacy application id', () => {
  const apps = [
    { id: 'app-1', vendor_id: 'user-a', booth_number: null },
    { id: 'app-2', vendor_id: 'user-b', booth_number: 3 },
  ]
  assert.equal(resolveApplicationForVendorKey('user-a', apps)?.id, 'app-1')
  assert.equal(resolveApplicationForVendorKey('app-2', apps)?.vendor_id, 'user-b')
})

test('collectBoothApplicationAssignments maps placed booths to applications', () => {
  const rooms = [
    baseRoom('main', [
      {
        id: 'booth-a',
        col: 0,
        row: 0,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Alpha',
        categoryName: 'Food',
        categoryColor: '#000',
        boothNumber: 2,
      },
      {
        id: 'booth-b',
        col: 12,
        row: 0,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Beta',
        categoryName: 'Craft',
        categoryColor: '#000',
        boothNumber: 5,
      },
    ]),
  ]
  const booths = new Map<string, BoothObject>([
    ['booth-a', vendorBooth('booth-a', 'vendor-alpha')],
    ['booth-b', vendorBooth('booth-b', 'vendor-beta')],
  ])
  const apps = [
    { id: 'app-alpha', vendor_id: 'vendor-alpha', booth_number: null },
    { id: 'app-beta', vendor_id: 'vendor-beta', booth_number: null },
  ]

  const assignments = collectBoothApplicationAssignments(rooms, booths, apps)
  assert.deepEqual(
    assignments.sort((a, b) => a.applicationId.localeCompare(b.applicationId)),
    [
      { applicationId: 'app-alpha', boothNumber: 2, tableLengthFt: null },
      { applicationId: 'app-beta', boothNumber: 5, tableLengthFt: null },
    ]
  )
})

test('collectBoothApplicationAssignments uses lowest booth for multi-booth vendors', () => {
  const rooms = [
    baseRoom('main', [
      {
        id: 'booth-1',
        col: 0,
        row: 0,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Multi',
        categoryName: 'Food',
        categoryColor: '#000',
        boothNumber: 8,
      },
      {
        id: 'booth-2',
        col: 12,
        row: 0,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Multi',
        categoryName: 'Food',
        categoryColor: '#000',
        boothNumber: 3,
      },
    ]),
  ]
  const booths = new Map<string, BoothObject>([
    ['booth-1', vendorBooth('booth-1', 'vendor-multi')],
    ['booth-2', vendorBooth('booth-2', 'vendor-multi')],
  ])
  const apps = [{ id: 'app-multi', vendor_id: 'vendor-multi', booth_number: null }]

  const assignments = collectBoothApplicationAssignments(rooms, booths, apps)
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0]?.boothNumber, 3)
})

test('collectBoothApplicationAssignments skips guest tables and unassigned booths', () => {
  const rooms = [
    baseRoom('main', [
      {
        id: 'guest-1',
        col: 0,
        row: 0,
        colSpan: 5,
        rowSpan: 5,
        vendorName: 'Guest',
        categoryName: '',
        categoryColor: '#000',
        boothNumber: 1,
        tablePurpose: 'guest',
      },
      {
        id: 'open-1',
        col: 8,
        row: 0,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Open',
        categoryName: 'Craft',
        categoryColor: '#000',
        boothNumber: 2,
      },
    ]),
  ]
  const booths = new Map<string, BoothObject>([
    [
      'guest-1',
      {
        ...vendorBooth('guest-1', 'vendor-guest'),
        tablePurpose: 'guest',
      },
    ],
    ['open-1', { ...vendorBooth('open-1', 'vendor-open'), vendorId: null }],
  ])
  const apps = [
    { id: 'app-guest', vendor_id: 'vendor-guest', booth_number: null },
    { id: 'app-open', vendor_id: 'vendor-open', booth_number: null },
  ]

  const assignments = collectBoothApplicationAssignments(rooms, booths, apps)
  assert.equal(assignments.length, 0)
})
