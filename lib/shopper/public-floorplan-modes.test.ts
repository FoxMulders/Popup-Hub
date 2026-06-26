/**
 * Unit checks for patron/vendor floor map cell classification — run:
 *   npx tsx lib/shopper/public-floorplan-modes.test.ts
 */
import assert from 'node:assert/strict'
import type { BoothCell } from '@/types/database'
import {
  filterGuestTableCells,
  filterVendorBoothCells,
  isGuestTableCell,
  isVendorBoothCell,
} from './public-floorplan-modes'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

function cell(overrides: Partial<BoothCell>): BoothCell {
  return {
    id: 'c1',
    col: 1,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
    vendorName: 'Vendor',
    categoryName: '',
    categoryColor: '#000',
    boothNumber: 1,
    boothType: 'inside',
    vendorUnitType: 'table',
    tableLengthFt: 6,
    tablePurpose: null,
    tableShape: null,
    tableOrientation: null,
    facingTarget: null,
    ...overrides,
  }
}

console.log('public-floorplan-modes')

test('round tables without tablePurpose classify as guest seating', () => {
  const roundGuest = cell({ tableShape: 'round', tablePurpose: null, vendorName: 'Seating' })
  assert.equal(isGuestTableCell(roundGuest), true)
  assert.equal(isVendorBoothCell(roundGuest), false)
})

test('explicit guest tables stay out of vendor booth filters', () => {
  const guest = cell({ tablePurpose: 'guest', vendorName: 'Seating' })
  assert.deepEqual(filterVendorBoothCells([guest]), [])
  assert.equal(filterGuestTableCells([guest]).length, 1)
})

test('vendor booths with tablePurpose vendor remain visible', () => {
  const vendor = cell({ tablePurpose: 'vendor', tableShape: 'rectangular', vendorName: 'Pottery Co' })
  assert.equal(isVendorBoothCell(vendor), true)
  assert.equal(filterGuestTableCells([vendor]).length, 0)
})

console.log('All public-floorplan-modes tests passed.')
