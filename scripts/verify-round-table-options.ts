/**
 * Guest + vendor table option smoke test.
 *
 * Run: npx tsx scripts/verify-round-table-options.ts
 */

import {
  GUEST_RECTANGULAR_TABLE_DEPTH_FT,
  GUEST_TABLE_LENGTHS_FT,
  boothDimensionsForTable,
  guestRectTableSpec,
  guestRoundTableSpec,
  isGuestTableLengthFt,
  tableSizeSpecFromBooth,
  tableSizeSpecsEqual,
  vendorTableSpec,
} from '../lib/booth-planner/table-shape'
import { boothDimensionsForTableLength } from '../lib/booth-planner/table-booth-consolidation'

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

assert(GUEST_TABLE_LENGTHS_FT.length === 3, 'three guest table lengths configured')
for (const ft of [5, 6, 8]) {
  assert(isGuestTableLengthFt(ft), `${ft}′ is a valid guest table length`)
}

for (const ft of GUEST_TABLE_LENGTHS_FT) {
  const dims = boothDimensionsForTable({
    tableLengthFt: ft,
    tableShape: 'round',
    tablePurpose: 'guest',
  })
  assert(dims.width === ft && dims.height === ft, `${ft}′ round → ${ft}×${ft} footprint`)
}

for (const ft of GUEST_TABLE_LENGTHS_FT) {
  const dims = boothDimensionsForTable({
    tableLengthFt: ft,
    tableShape: 'rectangular',
    tablePurpose: 'guest',
  })
  assert(
    dims.width === ft && dims.height === GUEST_RECTANGULAR_TABLE_DEPTH_FT,
    `${ft}′ guest rect → ${ft}×${GUEST_RECTANGULAR_TABLE_DEPTH_FT} footprint`
  )
}

const vendor = boothDimensionsForTableLength(6)
assert(vendor.width === 6 && vendor.height === 2, '6′ vendor booth stays 6×2')

const roundInferred = tableSizeSpecFromBooth({
  tableLengthFt: 8,
  tableShape: 'round',
  tablePurpose: 'guest',
  width: 8,
  height: 8,
})
assert(
  roundInferred != null &&
    tableSizeSpecsEqual(roundInferred, guestRoundTableSpec(8)),
  'guest round round-trips through tableSizeSpecFromBooth'
)

const rectInferred = tableSizeSpecFromBooth({
  tableLengthFt: 6,
  tableShape: 'rectangular',
  tablePurpose: 'guest',
  width: 6,
  height: GUEST_RECTANGULAR_TABLE_DEPTH_FT,
})
assert(
  rectInferred != null &&
    tableSizeSpecsEqual(rectInferred, guestRectTableSpec(6)),
  'guest rect round-trips through tableSizeSpecFromBooth'
)
const vendorInferred = tableSizeSpecFromBooth({
  tableLengthFt: 6,
  tableShape: 'rectangular',
  tablePurpose: 'vendor',
  width: 6,
  height: 2,
})
assert(
  vendorInferred != null &&
    tableSizeSpecsEqual(vendorInferred, vendorTableSpec(6)),
  'vendor booth round-trips through tableSizeSpecFromBooth'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
