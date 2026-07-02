import assert from 'node:assert/strict'
import {
  FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING,
  shouldShowFloorPlanMatrixSmallScreenWarning,
} from './dashboard-ledger-viewport-guard'

assert.equal(
  FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING,
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'
)

assert.equal(shouldShowFloorPlanMatrixSmallScreenWarning(390, 844), true)
assert.equal(shouldShowFloorPlanMatrixSmallScreenWarning(1200, 500), true)
assert.equal(shouldShowFloorPlanMatrixSmallScreenWarning(1024, 550), false)
assert.equal(shouldShowFloorPlanMatrixSmallScreenWarning(1440, 900), false)

console.log('dashboard ledger viewport guard regression checks passed')
